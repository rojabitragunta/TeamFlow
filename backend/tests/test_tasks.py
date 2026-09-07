from datetime import datetime, timedelta, timezone

from tests.conftest import auth_header, make_admin, make_role_user


def create_project(client, token):
    return client.post(
        "/api/projects",
        json={"name": "Task Project", "status": "active"},
        headers=auth_header(token),
    ).json()


def test_task_crud_lifecycle(client):
    admin_token, _ = make_admin(client)
    project = create_project(client, admin_token)

    resp = client.post(
        "/api/tasks",
        json={"title": "Build API", "project_id": project["id"], "priority": "high"},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["status"] == "todo"

    resp = client.put(
        f"/api/tasks/{task['id']}",
        json={"status": "in_progress"},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"

    resp = client.delete(f"/api/tasks/{task['id']}", headers=auth_header(admin_token))
    assert resp.status_code == 204


def test_team_member_can_only_update_status(client):
    admin_token, _ = make_admin(client)
    member_token, member = make_role_user(client, admin_token, "Member", "task_member@teamflow.com", "team_member")
    project = create_project(client, admin_token)
    task = client.post(
        "/api/tasks",
        json={"title": "Assigned Task", "project_id": project["id"], "assigned_to": member["id"]},
        headers=auth_header(admin_token),
    ).json()

    resp = client.put(
        f"/api/tasks/{task['id']}",
        json={"status": "in_progress"},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 200

    resp = client.put(
        f"/api/tasks/{task['id']}",
        json={"title": "Hacked Title"},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 403


def test_team_member_cannot_create_task(client):
    admin_token, _ = make_admin(client)
    member_token, _ = make_role_user(client, admin_token, "Member", "tc@teamflow.com", "team_member")
    project = create_project(client, admin_token)
    resp = client.post(
        "/api/tasks",
        json={"title": "X", "project_id": project["id"]},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 403


def test_overdue_detection(client):
    admin_token, _ = make_admin(client)
    project = create_project(client, admin_token)
    past_due = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    overdue_task = client.post(
        "/api/tasks",
        json={"title": "Late Task", "project_id": project["id"], "due_date": past_due},
        headers=auth_header(admin_token),
    ).json()

    resp = client.get("/api/tasks?overdue_only=true", headers=auth_header(admin_token))
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.json()]
    assert overdue_task["id"] in ids

    client.put(
        f"/api/tasks/{overdue_task['id']}",
        json={"status": "completed"},
        headers=auth_header(admin_token),
    )
    resp = client.get("/api/tasks?overdue_only=true", headers=auth_header(admin_token))
    ids = [t["id"] for t in resp.json()]
    assert overdue_task["id"] not in ids


def test_edit_task_reassigns_employee(client):
    admin_token, _ = make_admin(client)
    _, member_a = make_role_user(client, admin_token, "A", "editA@teamflow.com", "team_member")
    _, member_b = make_role_user(client, admin_token, "B", "editB@teamflow.com", "team_member")
    project = create_project(client, admin_token)
    task = client.post(
        "/api/tasks",
        json={"title": "Reassign me", "project_id": project["id"], "assigned_to": member_a["id"]},
        headers=auth_header(admin_token),
    ).json()

    resp = client.put(
        f"/api/tasks/{task['id']}",
        json={
            "title": "Reassigned task",
            "assigned_to": member_b["id"],
            "priority": "critical",
            "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        },
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Reassigned task"
    assert body["assigned_to"] == member_b["id"]
    assert body["priority"] == "critical"


def test_filter_tasks_by_assigned_employee(client):
    admin_token, _ = make_admin(client)
    _, member = make_role_user(client, admin_token, "Filt", "filt@teamflow.com", "team_member")
    project = create_project(client, admin_token)
    client.post(
        "/api/tasks",
        json={"title": "Mine", "project_id": project["id"], "assigned_to": member["id"]},
        headers=auth_header(admin_token),
    )
    client.post(
        "/api/tasks",
        json={"title": "Not mine", "project_id": project["id"]},
        headers=auth_header(admin_token),
    )

    resp = client.get(f"/api/tasks?assigned_to={member['id']}", headers=auth_header(admin_token))
    assert resp.status_code == 200
    titles = [t["title"] for t in resp.json()]
    assert titles == ["Mine"]


def test_task_filters(client):
    admin_token, _ = make_admin(client)
    project = create_project(client, admin_token)
    client.post(
        "/api/tasks",
        json={"title": "Critical Bug", "project_id": project["id"], "priority": "critical"},
        headers=auth_header(admin_token),
    )
    client.post(
        "/api/tasks",
        json={"title": "Minor Tweak", "project_id": project["id"], "priority": "low"},
        headers=auth_header(admin_token),
    )

    resp = client.get("/api/tasks?priority=critical", headers=auth_header(admin_token))
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "Critical Bug"

    resp = client.get("/api/tasks?keyword=Minor", headers=auth_header(admin_token))
    assert len(resp.json()) == 1
