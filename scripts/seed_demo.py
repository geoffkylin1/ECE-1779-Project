"""Populate a local SplitMate API with demo data."""

import json
import os
import secrets
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4


BASE_URL = "http://127.0.0.1:8080"
SUFFIX = uuid4().hex[:8]
PASSWORDS_FILE = Path(
    f"seed_credentials.{SUFFIX}.local.json"
)


def request(method, path, data=None, token=None):
    """Send a JSON HTTP request to the local FastAPI server."""
    headers = {"Content-Type": "application/json"}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(
        BASE_URL + path,
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise RuntimeError(
            f"{method} {path}: HTTP {exc.code}: {detail}"
        ) from exc


def save_credentials(credentials):
    """Store generated demo passwords in a private local file."""
    fd = os.open(
        PASSWORDS_FILE,
        os.O_WRONLY | os.O_CREAT | os.O_EXCL,
        0o600,
    )
    with os.fdopen(fd, "w") as file:
        json.dump(credentials, file, indent=2)
        file.write("\n")


def update_credentials(credentials):
    """Update the existing private credentials file."""
    with PASSWORDS_FILE.open("w") as file:
        json.dump(credentials, file, indent=2)
        file.write("\n")


def create_user(name, credentials):
    email = f"demo-{name.lower()}-{SUFFIX}@example.com"
    password = secrets.token_urlsafe(18)

    user = request(
        "POST",
        "/api/auth/register",
        {
            "email": email,
            "password": password,
            "display_name": name,
        },
    )

    credentials["users"][name] = {
        "id": user["id"],
        "email": email,
        "password": password,
    }
    update_credentials(credentials)

    login = request(
        "POST",
        "/api/auth/login",
        {
            "email": email,
            "password": password,
        },
    )

    return user["id"], login["access_token"]


def main():
    print("Checking local SplitMate API...")
    health = request("GET", "/api/health")
    assert health["status"] == "ok"

    credentials = {
        "base_url": BASE_URL,
        "users": {},
    }
    save_credentials(credentials)

    print("Creating demo users...")
    alice, alice_token = create_user("Alice", credentials)
    bob, bob_token = create_user("Bob", credentials)
    carol, carol_token = create_user("Carol", credentials)

    print("Creating demo group...")
    group = request(
        "POST",
        "/api/groups",
        {"name": "Apartment 4B"},
        alice_token,
    )

    group_id = group["id"]
    join_code = group["join_code"]

    credentials["group_id"] = group_id
    credentials["join_code"] = join_code
    update_credentials(credentials)

    for token in (bob_token, carol_token):
        request(
            "POST",
            "/api/groups/join",
            {"join_code": join_code},
            token,
        )

    base = f"/api/groups/{group_id}"

    print("Creating demo expense...")
    request(
        "POST",
        f"{base}/expenses",
        {
            "amount": "100.00",
            "payer_id": alice,
            "participant_ids": [alice, bob, carol],
            "category": "groceries",
            "date": "2026-11-15",
            "note": "Costco run",
        },
        alice_token,
    )

    print("Creating demo settlement...")
    request(
        "POST",
        f"{base}/settlements",
        {
            "from_user_id": bob,
            "to_user_id": alice,
            "amount": "33.33",
            "date": "2026-11-16",
            "note": "e-transfer",
        },
        bob_token,
    )

    balances = request(
        "GET",
        f"{base}/balances",
        token=alice_token,
    )

    actual = {
        entry["user_id"]: entry["net"]
        for entry in balances
    }
    expected = {
        alice: "33.33",
        bob: "0.00",
        carol: "-33.33",
    }

    if actual != expected:
        raise RuntimeError(
            f"Unexpected balances: {actual}"
        )

    print("\nDemo data created successfully!")
    print(f"Group ID: {group_id}")
    print(f"Join Code: {join_code}")
    print(f"Credentials saved to: {PASSWORDS_FILE}")

    print("\nFinal balances:")
    for name, user_id in (
        ("Alice", alice),
        ("Bob", bob),
        ("Carol", carol),
    ):
        print(f"  {name}: {actual[user_id]}")


if __name__ == "__main__":
    main()
