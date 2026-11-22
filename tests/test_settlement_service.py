"""Integration tests for settlement database operations."""

from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import select

from src.database import SessionLocal
from src.models import Group, Membership, Settlement, User
from src.settlement_service import (
    SettlementValidationError,
    create_settlement,
    list_settlements,
)


@pytest.mark.integration
def test_create_and_list_settlement():
    tag = uuid4().hex[:12]

    with SessionLocal() as db:
        group_id = None
        user_ids = []

        try:
            alice = User(
                email=f"alice-{tag}@example.com",
                password_hash="test-only-not-a-real-hash",
                display_name="Alice",
            )

            bob = User(
                email=f"bob-{tag}@example.com",
                password_hash="test-only-not-a-real-hash",
                display_name="Bob",
            )

            db.add_all([alice, bob])
            db.flush()

            user_ids = [alice.id, bob.id]

            group = Group(
                name="Settlement Test Group",
                join_code=tag[:8].upper(),
            )

            db.add(group)
            db.flush()
            group_id = group.id

            db.add_all([
                Membership(group_id=group_id, user_id=alice.id),
                Membership(group_id=group_id, user_id=bob.id),
            ])
            db.commit()

            settlement = create_settlement(
                db=db,
                group_id=group_id,
                created_by=bob.id,
                from_user_id=bob.id,
                to_user_id=alice.id,
                amount="33.33",
                settlement_date=date(2026, 11, 17),
                note="e-transfer",
            )

            assert settlement.amount == 33.33 or str(settlement.amount) == "33.33"

            results = list_settlements(db, group_id)

            assert len(results) == 1
            assert results[0]["amount"] == "33.33"
            assert results[0]["from_user_id"] == bob.id
            assert results[0]["to_user_id"] == alice.id

            print("Settlement create/list: PASSED")

            with pytest.raises(SettlementValidationError):
                create_settlement(
                    db=db,
                    group_id=group_id,
                    created_by=bob.id,
                    from_user_id=bob.id,
                    to_user_id=bob.id,
                    amount="10.00",
                    settlement_date=date(2026, 11, 17),
                )

        finally:
            db.rollback()

            if group_id is not None:
                for settlement in db.scalars(
                    select(Settlement).where(
                        Settlement.group_id == group_id
                    )
                ).all():
                    db.delete(settlement)

                for membership in db.scalars(
                    select(Membership).where(
                        Membership.group_id == group_id
                    )
                ).all():
                    db.delete(membership)

                db.flush()

                group = db.get(Group, group_id)
                if group:
                    db.delete(group)

            for user_id in user_ids:
                user = db.get(User, user_id)
                if user:
                    db.delete(user)

            db.commit()
