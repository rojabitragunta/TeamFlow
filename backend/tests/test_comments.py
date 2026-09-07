from tests.conftest import auth_header, make_admin, make_role_user


def setup_task(client, admin_token, assignee_id=None):
    project = client.post(
        "/api/projects", json={"name": "Comment Project", "status": "active"}, headers=auth_header(admin_token)
    ).json()
    task = client.post(
        "/api/tasks",
        json={"title": "Task with comments", "project_id": project["id"], "assigned_to": assignee_id},
        headers=auth_header(admin_token),
    ).json()
    return task


def test_add_and_list_comments(client):
    admin_token, _ = make_admin(client)
    task = setup_task(client, admin_token)

    resp = client.post(
        f"/api/tasks/{task['id']}/comments",
        json={"comment": "Looks good so far"},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 201

    resp = client.get(f"/api/tasks/{task['id']}/comments", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["comment"] == "Looks good so far"


def test_unassigned_member_cannot_comment(client):
    admin_token, _ = make_admin(client)
    member_token, _ = make_role_user(client, admin_token, "Outsider", "out@teamflow.com", "team_member")
    task = setup_task(client, admin_token)

    resp = client.post(
        f"/api/tasks/{task['id']}/comments",
        json={"comment": "sneaky"},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 403


def test_delete_comment_permission(client):
    admin_token, _ = make_admin(client)
    member_token, member = make_role_user(client, admin_token, "Assignee", "assignee@teamflow.com", "team_member")
    task = setup_task(client, admin_token, assignee_id=member["id"])

    comment = client.post(
        f"/api/tasks/{task['id']}/comments",
        json={"comment": "my note"},
        headers=auth_header(member_token),
    ).json()

    other_token, _ = make_role_user(client, admin_token, "Other", "other@teamflow.com", "team_member")
    resp = client.delete(f"/api/comments/{comment['id']}", headers=auth_header(other_token))
    assert resp.status_code == 403

    resp = client.delete(f"/api/comments/{comment['id']}", headers=auth_header(member_token))
    assert resp.status_code == 204
