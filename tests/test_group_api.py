"""HTTP integration tests for Group Management."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.api import app, get_db
from src.database import engine


TEST_SECRET = "splitmate-test-jwt-secret-12345678901234567890"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", TEST_SECRET)

    with engine.connect() as connection:
        transaction = connection.begin()

        try:
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
        finally:
            transaction.rollback()


def register_and_login(client, name):
    """Create a user and return authenticated headers."""
    email = f"{name.lower()}-{uuid4().hex}@example.com"
    password = "mypassword123"

    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": name,
        },
    )
    assert response.status_code == 201

    user = response.json()

    response = client.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )
    assert response.status_code == 200

    token = response.json()["access_token"]

    return user, {
        "Authorization": f"Bearer {token}"
    }


@pytest.mark.integration
def test_create_join_and_list_groups(client):
    alice, alice_headers = register_and_login(
        client, "Alice"
    )
    bob, bob_headers = register_and_login(
        client, "Bob"
    )

    # Alice creates a group.
    response = client.post(
        "/api/groups",
        json={"name": "Apartment 4B"},
        headers=alice_headers,
    )

    assert response.status_code == 201
    group = response.json()

    group_id = group["id"]
    join_code = group["join_code"]

    assert len(join_code) == 8
    assert group["name"] == "Apartment 4B"
    assert len(group["members"]) == 1

    # Alice can list her group.
    response = client.get(
        "/api/groups",
        headers=alice_headers,
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == group_id

    # Bob joins using the invitation code.
    response = client.post(
        "/api/groups/join",
        json={"join_code": join_code.lower()},
        headers=bob_headers,
    )

    assert response.status_code == 200
    assert len(response.json()["members"]) == 2

    # Both users can now read group details.
    for headers in (alice_headers, bob_headers):
        response = client.get(
            f"/api/groups/{group_id}",
            headers=headers,
        )
        assert response.status_code == 200
        assert len(response.json()["members"]) == 2

    # Joining again is a conflict.
    response = client.post(
        "/api/groups/join",
        json={"join_code": join_code},
        headers=bob_headers,
    )
    assert response.status_code == 409


@pytest.mark.integration
def test_group_access_control(client):
    alice, alice_headers = register_and_login(
        client, "Alice"
    )
    outsider, outsider_headers = register_and_login(
        client, "Outsider"
    )

    response = client.post(
        "/api/groups",
        json={"name": "Private Group"},
        headers=alice_headers,
    )
    assert response.status_code == 201
    group_id = response.json()["id"]

    # No JWT -> 401.
    response = client.get(
        f"/api/groups/{group_id}"
    )
    assert response.status_code == 401

    # Existing group but not a member -> 403.
    response = client.get(
        f"/api/groups/{group_id}",
        headers=outsider_headers,
    )
    assert response.status_code == 403

    # Unknown group -> 404.
    response = client.get(
        "/api/groups/-1",
        headers=alice_headers,
    )
    assert response.status_code == 404

    # Outsider cannot see private groups in their list.
    response = client.get(
        "/api/groups",
        headers=outsider_headers,
    )
    assert response.status_code == 200
    assert response.json() == []

    # Invalid name -> 422.
    response = client.post(
        "/api/groups",
        json={"name": ""},
        headers=alice_headers,
    )
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)

    # Invalid invitation code -> 422.
    response = client.post(
        "/api/groups/join",
        json={"join_code": "123"},
        headers=outsider_headers,
    )
    assert response.status_code == 422
