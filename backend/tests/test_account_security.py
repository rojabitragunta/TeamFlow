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


def test_manager_cannot_reset_admins_password(client):
    admin_token, admin = make_admin(client)
    pm_token, _ = make_role_user(client, admin_token, "PM", "pm-security@teamflow.com", "project_manager")

    resp = client.put(
        f"/api/users/{admin['id']}",
        json={"password": "pwned1234"},
        headers=auth_header(pm_token),
    )
    assert resp.status_code == 403

    # Admin's real password must still work.
    login = client.post("/api/auth/login", json={"email": admin["email"], "password": "password123"})
    assert login.status_code == 200


def test_manager_cannot_reset_other_managers_password(client):
    admin_token, _ = make_admin(client)
    pm1_token, _ = make_role_user(client, admin_token, "PM One", "pm-one@teamflow.com", "project_manager")
    _, pm2 = make_role_user(client, admin_token, "PM Two", "pm-two@teamflow.com", "project_manager")

    resp = client.put(
        f"/api/users/{pm2['id']}",
        json={"password": "pwned1234"},
        headers=auth_header(pm1_token),
    )
    assert resp.status_code == 403


def test_manager_can_change_team_members_password_is_still_blocked(client):
    admin_token, _ = make_admin(client)
    pm_token, _ = make_role_user(client, admin_token, "PM", "pm-tm@teamflow.com", "project_manager")
    _, member = make_role_user(client, admin_token, "Member", "member-tm@teamflow.com", "team_member")

    resp = client.put(
        f"/api/users/{member['id']}",
        json={"password": "pwned1234"},
        headers=auth_header(pm_token),
    )
    assert resp.status_code == 403


def test_manager_cannot_edit_admin_profile(client):
    admin_token, admin = make_admin(client)
    pm_token, _ = make_role_user(client, admin_token, "PM", "pm-editadmin@teamflow.com", "project_manager")

    resp = client.put(
        f"/api/users/{admin['id']}",
        json={"name": "Hacked Admin"},
        headers=auth_header(pm_token),
    )
    assert resp.status_code == 403


def test_manager_can_still_edit_team_member_profile(client):
    admin_token, _ = make_admin(client)
    pm_token, _ = make_role_user(client, admin_token, "PM", "pm-editmember@teamflow.com", "project_manager")
    _, member = make_role_user(client, admin_token, "Member", "member-edit@teamflow.com", "team_member")

    resp = client.put(
        f"/api/users/{member['id']}",
        json={"name": "Renamed By PM"},
        headers=auth_header(pm_token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed By PM"


def test_weak_password_rejected_on_register(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "name": "Weak Pw",
            "email": "weakpw@teamflow.com",
            "password": "aaaaaaaa",
            "confirm_password": "aaaaaaaa",
        },
    )
    assert resp.status_code == 422

    resp2 = client.post(
        "/api/auth/register",
        json={
            "name": "Weak Pw",
            "email": "weakpw2@teamflow.com",
            "password": "short1",
            "confirm_password": "short1",
        },
    )
    assert resp2.status_code == 422
