"""End-to-end HTTP tests for SplitMate finances."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.api import app, get_db
from src.database import engine


TEST_SECRET = "splitmate-test-jwt-secret-12345678901234567890"


@pytest.fixture
def client(monkeypatch):
    """Run HTTP tests in a rollback-only DB transaction."""
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


def new_user(client, name):
    """Register, log in, and return user ID and JWT headers."""
    email = f"{name.lower()}-{uuid4().hex}@example.com"
    password = "testpassword123"

    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": name,
        },
    )
    assert response.status_code == 201, response.text

    user_id = response.json()["id"]

    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text

    token = response.json()["access_token"]
    return user_id, {"Authorization": f"Bearer {token}"}


def create_three_member_group(client):
    """Create a group containing Alice, Bob, and Carol."""
    alice, alice_headers = new_user(client, "Alice")
    bob, bob_headers = new_user(client, "Bob")
    carol, carol_headers = new_user(client, "Carol")

    response = client.post(
        "/api/groups",
        json={"name": "Apartment 4B"},
        headers=alice_headers,
    )
    assert response.status_code == 201, response.text

    group = response.json()
    group_id = group["id"]
    code = group["join_code"]

    for headers in (bob_headers, carol_headers):
        response = client.post(
            "/api/groups/join",
            json={"join_code": code},
            headers=headers,
        )
        assert response.status_code == 200, response.text

    return {
        "group_id": group_id,
        "alice": alice,
        "bob": bob,
        "carol": carol,
        "alice_headers": alice_headers,
        "bob_headers": bob_headers,
        "carol_headers": carol_headers,
    }


@pytest.mark.integration
def test_expense_split_balance_and_settlement(client):
    ctx = create_three_member_group(client)

    gid = ctx["group_id"]
    alice = ctx["alice"]
    bob = ctx["bob"]
    carol = ctx["carol"]
    headers = ctx["alice_headers"]

    base = f"/api/groups/{gid}"

    # 1. Alice pays $100 for three people.
    response = client.post(
        f"{base}/expenses",
        headers=headers,
        json={
            "amount": "100",
            "payer_id": alice,
            "participant_ids": [alice, bob, carol],
            "category": "groceries",
            "date": "2026-11-15",
            "note": "Costco run",
        },
    )

    assert response.status_code == 201, response.text
    expense = response.json()

    assert expense["amount"] == "100.00"
    assert expense["payer_id"] == alice
    assert expense["created_by"] == alice
    assert expense["category"] == "groceries"

    shares = {
        item["user_id"]: item["amount"]
        for item in expense["shares"]
    }
    assert shares == {
        alice: "33.34",
        bob: "33.33",
        carol: "33.33",
    }

    # 2. List expenses.
    response = client.get(
        f"{base}/expenses",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1

    # 3. Category/date filtering.
    response = client.get(
        f"{base}/expenses",
        params={
            "from": "2026-11-01",
            "to": "2026-11-30",
            "category": "groceries",
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1

    response = client.get(
        f"{base}/expenses",
        params={"category": "rent"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json() == []

    # 4. Check balances before settlement.
    response = client.get(
        f"{base}/balances",
        headers=headers,
    )
    assert response.status_code == 200, response.text

    before = {
        item["user_id"]: item["net"]
        for item in response.json()
    }
    assert before == {
        alice: "66.66",
        bob: "-33.33",
        carol: "-33.33",
    }

    # 5. Bob repays Alice $33.33.
    response = client.post(
        f"{base}/settlements",
        headers=ctx["bob_headers"],
        json={
            "from_user_id": bob,
            "to_user_id": alice,
            "amount": "33.33",
            "date": "2026-11-16",
            "note": "e-transfer",
        },
    )

    assert response.status_code == 201, response.text
    settlement = response.json()

    assert settlement["amount"] == "33.33"
    assert settlement["from_user_id"] == bob
    assert settlement["to_user_id"] == alice

    # 6. List settlements.
    response = client.get(
        f"{base}/settlements",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1

    # 7. Check updated balances.
    response = client.get(
        f"{base}/balances",
        headers=headers,
    )
    assert response.status_code == 200, response.text

    after = {
        item["user_id"]: item["net"]
        for item in response.json()
    }
    assert after == {
        alice: "33.33",
        bob: "0.00",
        carol: "-33.33",
    }


@pytest.mark.integration
def test_finance_access_control(client):
    ctx = create_three_member_group(client)

    gid = ctx["group_id"]
    alice = ctx["alice"]
    bob = ctx["bob"]

    _, outsider_headers = new_user(client, "Outsider")

    base = f"/api/groups/{gid}"

    expense_data = {
        "amount": "20.00",
        "payer_id": alice,
        "participant_ids": [alice, bob],
        "category": "dining",
        "date": "2026-11-15",
    }

    settlement_data = {
        "from_user_id": bob,
        "to_user_id": alice,
        "amount": "10.00",
        "date": "2026-11-16",
    }

    # An outsider cannot read or write financial data.
    requests = [
        ("GET", f"{base}/expenses", None),
        ("GET", f"{base}/balances", None),
        ("GET", f"{base}/settlements", None),
        ("POST", f"{base}/expenses", expense_data),
        ("POST", f"{base}/settlements", settlement_data),
    ]

    for method, url, payload in requests:
        response = client.request(
            method,
            url,
            json=payload,
            headers=outsider_headers,
        )
        assert response.status_code == 403, (
            method, url, response.text
        )

    # A missing token must produce 401.
    response = client.get(f"{base}/balances")
    assert response.status_code == 401

    # An unknown group must produce 404.
    response = client.get(
        "/api/groups/-1/balances",
        headers=ctx["alice_headers"],
    )
    assert response.status_code == 404


@pytest.mark.integration
def test_finance_validation(client):
    ctx = create_three_member_group(client)

    gid = ctx["group_id"]
    alice = ctx["alice"]
    bob = ctx["bob"]
    headers = ctx["alice_headers"]

    base = f"/api/groups/{gid}"

    # Invalid money precision -> 422.
    response = client.post(
        f"{base}/expenses",
        headers=headers,
        json={
            "amount": "10.123",
            "payer_id": alice,
            "participant_ids": [alice, bob],
            "category": "groceries",
            "date": "2026-11-15",
        },
    )
    assert response.status_code == 422, response.text

    # Duplicate participants -> 422.
    response = client.post(
        f"{base}/expenses",
        headers=headers,
        json={
            "amount": "10.00",
            "payer_id": alice,
            "participant_ids": [bob, bob],
            "category": "groceries",
            "date": "2026-11-15",
        },
    )
    assert response.status_code == 422, response.text

    # Invalid category -> 422.
    response = client.get(
        f"{base}/expenses",
        params={"category": "invalid"},
        headers=headers,
    )
    assert response.status_code == 422, response.text

    # Same sender and receiver -> 400.
    response = client.post(
        f"{base}/settlements",
        headers=headers,
        json={
            "from_user_id": alice,
            "to_user_id": alice,
            "amount": "5.00",
            "date": "2026-11-16",
        },
    )
    assert response.status_code == 400, response.text

    # Error responses must use string detail.
    assert isinstance(response.json()["detail"], str)
