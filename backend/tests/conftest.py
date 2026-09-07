import os

os.environ.setdefault("ADMIN_SETUP_TOKEN", "test-setup-token")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.limiter import limiter
from app.database.database import Base, get_db
from app.main import app

TEST_ADMIN_SETUP_TOKEN = os.environ["ADMIN_SETUP_TOKEN"]

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def _fresh_db():
    Base.metadata.create_all(bind=engine)
    limiter.reset()
    yield
    Base.metadata.drop_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def client():
    return TestClient(app)


def register_user(client, name, email, password="password123", confirm=None):
    return client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
            "confirm_password": confirm or password,
        },
    )


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_admin(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "name": "Admin User",
            "email": "admin@teamflow.com",
            "password": "password123",
            "confirm_password": "password123",
            "setup_token": TEST_ADMIN_SETUP_TOKEN,
        },
    )
    return resp.json()["access_token"], resp.json()["user"]


def make_role_user(client, admin_token, name, email, role):
    resp = client.post(
        "/api/users",
        json={"name": name, "email": email, "password": "password123", "role": role},
        headers=auth_header(admin_token),
    )
    user = resp.json()
    login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    return login.json()["access_token"], user

