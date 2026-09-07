from tests.conftest import auth_header, make_admin, make_role_user, register_user


def test_manager_can_add_member_but_not_elevate_role(client):
    admin_token, _ = make_admin(client)
    pm_token, _ = make_role_user(client, admin_token, "PM", "pm2@teamflow.com", "project_manager")

    resp = client.post(
        "/api/users",
        json={"name": "New Hire", "email": "hire@teamflow.com", "password": "password123", "role": "admin"},
        headers=auth_header(pm_token),
    )
    assert resp.status_code == 201
    # PM tried to create an admin — backend must force it down to team_member.
    assert resp.json()["role"] == "team_member"


def test_team_member_cannot_add_members(client):
    admin_token, _ = make_admin(client)
    member_token, _ = make_role_user(client, admin_token, "Member", "mem@teamflow.com", "team_member")
    resp = client.post(
        "/api/users",
        json={"name": "X", "email": "x2@teamflow.com", "password": "password123", "role": "team_member"},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 403


def test_admin_can_change_role(client):
    admin_token, _ = make_admin(client)
    _, member = make_role_user(client, admin_token, "Member", "role1@teamflow.com", "team_member")
    resp = client.put(
        f"/api/users/{member['id']}",
        json={"role": "project_manager"},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "project_manager"


def test_member_cannot_change_own_role(client):
    admin_token, _ = make_admin(client)
    member_token, member = make_role_user(client, admin_token, "Member", "role2@teamflow.com", "team_member")
    resp = client.put(
        f"/api/users/{member['id']}",
        json={"role": "admin"},
        headers=auth_header(member_token),
    )
    assert resp.status_code == 200
    # role silently ignored for non-admins — user is not elevated.
    assert resp.json()["role"] == "team_member"


def test_self_password_change_requires_current_password(client):
    reg = register_user(client, "Pwd User", "pwd@teamflow.com", password="original123")
    token = reg.json()["access_token"]
    user_id = reg.json()["user"]["id"]

    resp = client.put(
        f"/api/users/{user_id}",
        json={"password": "newpassword123"},
        headers=auth_header(token),
    )
    assert resp.status_code == 400

    resp = client.put(
        f"/api/users/{user_id}",
        json={"password": "newpassword123", "current_password": "wrongpass"},
        headers=auth_header(token),
    )
    assert resp.status_code == 400

    resp = client.put(
        f"/api/users/{user_id}",
        json={"password": "newpassword123", "current_password": "original123"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200

    login = client.post("/api/auth/login", json={"email": "pwd@teamflow.com", "password": "newpassword123"})
    assert login.status_code == 200


def test_deactivated_user_cannot_login(client):
    admin_token, _ = make_admin(client)
    _, member = make_role_user(client, admin_token, "Inactive", "inactive@teamflow.com", "team_member")

    resp = client.put(
        f"/api/users/{member['id']}",
        json={"is_active": False},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    resp = client.post("/api/auth/login", json={"email": "inactive@teamflow.com", "password": "password123"})
    assert resp.status_code == 403


def test_duplicate_email_on_update_rejected(client):
    admin_token, _ = make_admin(client)
    _, member_a = make_role_user(client, admin_token, "A", "dupA@teamflow.com", "team_member")
    _, member_b = make_role_user(client, admin_token, "B", "dupB@teamflow.com", "team_member")

    resp = client.put(
        f"/api/users/{member_b['id']}",
        json={"email": "dupA@teamflow.com"},
        headers=auth_header(admin_token),
    )
    assert resp.status_code == 409
