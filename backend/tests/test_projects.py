from tests.conftest import auth_header, make_admin, make_role_user


def create_project(client, token, name="Website Revamp"):
    return client.post(
        "/api/projects",
        json={"name": name, "description": "desc", "status": "active"},
        headers=auth_header(token),
    )


def test_manager_can_create_project(client):
    admin_token, _ = make_admin(client)
    pm_token, _ = make_role_user(client, admin_token, "PM", "pm@teamflow.com", "project_manager")
    resp = create_project(client, pm_token)
    assert resp.status_code == 201
    assert resp.json()["name"] == "Website Revamp"


def test_team_member_cannot_create_project(client):
    admin_token, _ = make_admin(client)
    member_token, _ = make_role_user(client, admin_token, "Member", "tm@teamflow.com", "team_member")
    resp = create_project(client, member_token)
    assert resp.status_code == 403


def test_project_crud_lifecycle(client):
    admin_token, _ = make_admin(client)
    created = create_project(client, admin_token).json()
    project_id = created["id"]

    resp = client.get(f"/api/projects/{project_id}", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert resp.json()["progress"] == 0.0

    resp = client.put(
        f"/api/projects/{project_id}",
        json={"status": "completed"},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"

    resp = client.delete(f"/api/projects/{project_id}", headers=auth_header(admin_token))
    assert resp.status_code == 204

    resp = client.get(f"/api/projects/{project_id}", headers=auth_header(admin_token))
    assert resp.status_code == 404


def test_add_and_remove_project_member(client):
    admin_token, _ = make_admin(client)
    _, member = make_role_user(client, admin_token, "Member", "add@teamflow.com", "team_member")
    project = create_project(client, admin_token).json()

    resp = client.post(
        f"/api/projects/{project['id']}/members",
        json={"user_id": member["id"]},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 201

    detail = client.get(f"/api/projects/{project['id']}", headers=auth_header(admin_token)).json()
    assert len(detail["members"]) == 2  # admin (creator) + added member

    resp = client.delete(
        f"/api/projects/{project['id']}/members/{member['id']}", headers=auth_header(admin_token)
    )
    assert resp.status_code == 204


def test_team_member_only_sees_own_projects(client):
    admin_token, _ = make_admin(client)
    member_token, member = make_role_user(client, admin_token, "Member", "view@teamflow.com", "team_member")
    project = create_project(client, admin_token).json()

    resp = client.get("/api/projects", headers=auth_header(member_token))
    assert resp.json() == []

    client.post(
        f"/api/projects/{project['id']}/members",
        json={"user_id": member["id"]},
        headers=auth_header(admin_token),
    )
    resp = client.get("/api/projects", headers=auth_header(member_token))
    assert len(resp.json()) == 1
