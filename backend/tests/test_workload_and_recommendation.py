from datetime import datetime, timedelta, timezone

from tests.conftest import auth_header, make_admin, make_role_user


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
