"""Integration tests for Group Management."""

from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from src.database import engine
from src.models import User
from src.group_service import (
    AlreadyMemberError,
    GroupAccessError,
    GroupNotFoundError,
    create_group,
    get_group,
    join_group,
    list_groups,
)


@pytest.fixture
def db():
    """Use an outer transaction to isolate test data."""
    with engine.connect() as connection:
        transaction = connection.begin()

        try:
            with Session(
                bind=connection,
                join_transaction_mode="create_savepoint",
                expire_on_commit=False,
            ) as session:
                yield session
        finally:
            transaction.rollback()


@pytest.mark.integration
def test_group_creation_and_join(db):
    tag = uuid4().hex

    alice = User(
        email=f"alice-{tag}@example.com",
        password_hash="test-only",
        display_name="Alice",
    )

    bob = User(
        email=f"bob-{tag}@example.com",
        password_hash="test-only",
        display_name="Bob",
    )

    db.add_all([alice, bob])
    db.flush()

    # Alice creates a group.
    group = create_group(db, alice.id, "Apartment 4B")

    assert group.id is not None
    assert len(group.join_code) == 8

    # Alice automatically becomes a member.
    details = get_group(db, group.id, alice.id)

    assert details["name"] == "Apartment 4B"
    assert len(details["members"]) == 1
    assert details["members"][0]["user_id"] == alice.id

    # Bob joins using a lowercase code.
    joined = join_group(
        db, bob.id, group.join_code.lower()
    )

    assert len(joined["members"]) == 2
    assert joined["join_code"] == group.join_code

    # Both users can see their group.
    alice_groups = list_groups(db, alice.id)
    bob_groups = list_groups(db, bob.id)

    assert len(alice_groups) == 1
    assert len(bob_groups) == 1
    assert alice_groups[0]["member_count"] == 2

    # Joining again must fail.
    with pytest.raises(AlreadyMemberError):
        join_group(db, bob.id, group.join_code)


@pytest.mark.integration
def test_group_access_control(db):
    tag = uuid4().hex

    alice = User(
        email=f"alice-{tag}@example.com",
        password_hash="test-only",
        display_name="Alice",
    )

    outsider = User(
        email=f"outsider-{tag}@example.com",
        password_hash="test-only",
        display_name="Outsider",
    )

    db.add_all([alice, outsider])
    db.flush()

    group = create_group(db, alice.id, "Private Group")

    # Outsider cannot read group details.
    with pytest.raises(GroupAccessError):
        get_group(db, group.id, outsider.id)

    # Outsider has no groups.
    assert list_groups(db, outsider.id) == []

    # Unknown group returns not found.
    with pytest.raises(GroupNotFoundError):
        get_group(db, -1, alice.id)

    # Invalid join code returns not found.
    with pytest.raises(GroupNotFoundError):
        join_group(db, outsider.id, "ZZZZZZZZ")
