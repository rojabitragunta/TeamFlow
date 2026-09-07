from tests.conftest import TEST_ADMIN_SETUP_TOKEN, make_admin, register_user


def test_register_without_setup_token_is_team_member(client):
    resp = register_user(client, "Regular User", "regular@teamflow.com")
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["role"] == "team_member"
    assert "access_token" in body


def test_register_with_wrong_setup_token_is_team_member(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "name": "Impostor",
            "email": "impostor@teamflow.com",
            "password": "password123",
            "confirm_password": "password123",
            "setup_token": "not-the-right-token",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["user"]["role"] == "team_member"


def test_register_with_correct_setup_token_becomes_admin(client):
    token, user = make_admin(client)
    assert user["role"] == "admin"
    assert token


def test_register_password_mismatch(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "name": "Bad User",
            "email": "bad@teamflow.com",
            "password": "password123",
            "confirm_password": "different",
        },
    )
    assert resp.status_code == 400


def test_register_duplicate_email(client):
    register_user(client, "First", "dup@teamflow.com")
    resp = register_user(client, "Second", "dup@teamflow.com")
    assert resp.status_code == 400


def test_login_success(client):
    register_user(client, "Login User", "login@teamflow.com", password="secret123")
    resp = client.post("/api/auth/login", json={"email": "login@teamflow.com", "password": "secret123"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_invalid_password(client):
    register_user(client, "Login User", "login2@teamflow.com", password="secret123")
    resp = client.post("/api/auth/login", json={"email": "login2@teamflow.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/api/auth/login", json={"email": "nobody@teamflow.com", "password": "whatever"})
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_valid_token(client):
    reg = register_user(client, "Me User", "me@teamflow.com")
    token = reg.json()["access_token"]
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@teamflow.com"
