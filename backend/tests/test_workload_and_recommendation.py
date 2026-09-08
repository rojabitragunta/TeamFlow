from datetime import datetime, timedelta, timezone

from sqlalchemy import event

from tests.conftest import auth_header, engine, make_admin, make_role_user


def test_workload_calculation(client):
    admin_token, _ = make_admin(client)
    member_token, member = make_role_user(client, admin_token, "Worker", "worker@teamflow.com", "team_member")
    project = client.post(
        "/api/projects", json={"name": "Workload Project", "status": "active"}, headers=auth_header(admin_token)
    ).json()

    client.post(
        "/api/tasks",
        json={"title": "T1", "project_id": project["id"], "assigned_to": member["id"], "status": "completed"},
        headers=auth_header(admin_token),
    )
    client.post(
        "/api/tasks",
        json={"title": "T2", "project_id": project["id"], "assigned_to": member["id"]},
        headers=auth_header(admin_token),
    )

    resp = client.get("/api/workload/me", headers=auth_header(member_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tasks"] == 2
    assert data["completed_tasks"] == 1
    assert data["active_tasks"] == 1
    assert data["completion_rate"] == 50.0


def test_smart_assignee_recommendation(client):
    admin_token, _ = make_admin(client)
    project = client.post(
        "/api/projects", json={"name": "Reco Project", "status": "active"}, headers=auth_header(admin_token)
    ).json()

    _, busy = make_role_user(client, admin_token, "Busy Person", "busy@teamflow.com", "team_member")
    _, free = make_role_user(client, admin_token, "Free Person", "free@teamflow.com", "team_member")

    for person in (busy, free):
        client.post(
            f"/api/projects/{project['id']}/members",
            json={"user_id": person["id"]},
            headers=auth_header(admin_token),
        )

    past_due = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    for i in range(3):
        client.post(
            "/api/tasks",
            json={
                "title": f"Busy task {i}",
                "project_id": project["id"],
                "assigned_to": busy["id"],
                "due_date": past_due,
            },
            headers=auth_header(admin_token),
        )

    resp = client.get(f"/api/tasks/recommend/{project['id']}", headers=auth_header(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["candidates"]) == 3  # admin + busy + free are all members

    scores = {c["user_id"]: c["score"] for c in body["candidates"]}
    assert scores[free["id"]] > scores[busy["id"]]
    assert body["recommended"]["user_id"] != busy["id"]


def _count_queries(fn):
    count = 0

    def _listener(*args, **kwargs):
        nonlocal count
        count += 1

    event.listen(engine, "before_cursor_execute", _listener)
    try:
        fn()
    finally:
        event.remove(engine, "before_cursor_execute", _listener)
    return count


def test_team_workload_does_not_grow_query_count_per_user(client):
    admin_token, _ = make_admin(client)
    for i in range(6):
        make_role_user(client, admin_token, f"Worker {i}", f"worker{i}@teamflow.com", "team_member")

    # Batched workload computation should issue a small, constant number of
    # queries regardless of team size (was previously one query per user).
    query_count = _count_queries(lambda: client.get("/api/workload", headers=auth_header(admin_token)))
    assert query_count <= 3, f"expected a small constant number of queries, got {query_count}"
