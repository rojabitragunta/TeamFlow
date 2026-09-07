from tests.conftest import auth_header, make_admin, make_role_user, register_user


def test_admin_can_create_user(client):
    admin_token, _ = make_admin(client)
    resp = client.post(
        "/api/users",
        json={"name": "New Member", "email": "member1@teamflow.com", "password": "password123", "role": "team_member"},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "team_member"


def test_non_admin_cannot_create_user(client):
    admin_token, _ = make_admin(client)
    member_token, _ = make_role_user(client, admin_token, "Member", "m2@teamflow.com", "team_member")
    resp = client.post(
        "/api/users",
        json={"name": "X", "email": "x@teamflow.com", "password": "password123", "role": "team_member"},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 403


def test_list_users(client):
    admin_token, _ = make_admin(client)
    resp = client.get("/api/users", headers=auth_header(admin_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_update_own_profile(client):
    admin_token, admin = make_admin(client)
    member_token, member = make_role_user(client, admin_token, "Member", "m3@teamflow.com", "team_member")
    resp = client.put(
        f"/api/users/{member['id']}",
        json={"name": "Updated Name"},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


def test_cannot_update_other_user(client):
    admin_token, _ = make_admin(client)
    member_token, _ = make_role_user(client, admin_token, "Member A", "ma@teamflow.com", "team_member")
    _, member_b = make_role_user(client, admin_token, "Member B", "mb@teamflow.com", "team_member")
    resp = client.put(
        f"/api/users/{member_b['id']}",
        json={"name": "Hacked"},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 403


def test_admin_can_delete_user(client):
    admin_token, _ = make_admin(client)
    _, member = make_role_user(client, admin_token, "Del Member", "del@teamflow.com", "team_member")
    resp = client.delete(f"/api/users/{member['id']}", headers=auth_header(admin_token))
    assert resp.status_code == 204
