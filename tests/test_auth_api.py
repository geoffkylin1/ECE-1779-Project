"""HTTP integration tests for Authentication endpoints."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.api import app, get_db
from src.database import engine


TEST_SECRET = "splitmate-test-jwt-secret-12345678901234567890"


@pytest.fixture
def client(monkeypatch):
    """Provide a TestClient and rollback database changes."""
    monkeypatch.setenv("JWT_SECRET_KEY", TEST_SECRET)

    with engine.connect() as connection:
        transaction = connection.begin()

        with Session(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        ) as db:

            def override_get_db():
                yield db

            app.dependency_overrides[get_db] = override_get_db

            try:
                with TestClient(app) as test_client:
                    yield test_client
            finally:
                app.dependency_overrides.clear()
                db.close()
                transaction.rollback()


@pytest.mark.integration
def test_register_login_and_me(client):
    email = f"alice-{uuid4().hex}@example.com"

    # 1. Register.
    response = client.post(
        "/api/auth/register",
        json={
            "email": email.upper(),
            "password": "mypassword123",
            "display_name": "Alice",
        },
    )

    assert response.status_code == 201
    user = response.json()
    assert user["email"] == email
    assert "password_hash" not in user

    # 2. Login.
    response = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": "mypassword123",
        },
    )

    assert response.status_code == 200
    token_data = response.json()

    assert token_data["token_type"] == "bearer"
    assert token_data["expires_in"] == 3600
    assert token_data["access_token"]

    token = token_data["access_token"]

    # 3. Access protected endpoint.
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["id"] == user["id"]
    assert response.json()["email"] == email

    # 4. Wrong password.
    response = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": "wrongpassword",
        },
    )
    assert response.status_code == 401

    # 5. Duplicate email.
    response = client.post(
        "/api/auth/register",
        json={
            "email": email.upper(),
            "password": "anotherpassword123",
            "display_name": "Duplicate",
        },
    )
    assert response.status_code == 409


@pytest.mark.integration
def test_invalid_authentication(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


@pytest.mark.integration
def test_validation_error_format(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "invalid-email",
            "password": "123",
            "display_name": "",
        },
    )

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
