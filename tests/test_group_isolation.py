"""Integration tests for group-level data isolation."""

from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from src.database import engine
from src.models import Group, Membership, User
from src.expense_service import (
    ExpenseValidationError,
    create_expense,
    list_expenses,
)
from src.balance_service import calculate_balances
from src.settlement_service import (
    SettlementValidationError,
    create_settlement,
    list_settlements,
)


@pytest.mark.integration
def test_group_data_isolation():
    # The outer transaction is rolled back after testing.
    with engine.connect() as connection:
        transaction = connection.begin()

        try:
            with Session(
                bind=connection,
                join_transaction_mode="create_savepoint",
                expire_on_commit=False,
            ) as db:

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
                carol = User(
                    email=f"carol-{tag}@example.com",
                    password_hash="test-only",
                    display_name="Carol",
                )
                david = User(
                    email=f"david-{tag}@example.com",
                    password_hash="test-only",
                    display_name="David",
                )

                db.add_all([alice, bob, carol, david])
                db.flush()

                group_a = Group(
                    name="Apartment",
                    join_code=tag[:8].upper(),
                )
                group_b = Group(
                    name="Ski Trip",
                    join_code=tag[8:16].upper(),
                )

                db.add_all([group_a, group_b])
                db.flush()

                db.add_all([
                    Membership(
                        group_id=group_a.id,
                        user_id=alice.id,
                    ),
                    Membership(
                        group_id=group_a.id,
                        user_id=bob.id,
                    ),
                    Membership(
                        group_id=group_b.id,
                        user_id=carol.id,
                    ),
                    Membership(
                        group_id=group_b.id,
                        user_id=david.id,
                    ),
                ])
                db.flush()

                # Group A: Alice pays $100 for Alice and Bob.
                create_expense(
                    db=db,
                    group_id=group_a.id,
                    created_by=alice.id,
                    payer_id=alice.id,
                    participant_ids=[alice.id, bob.id],
                    amount="100.00",
                    category="groceries",
                    expense_date=date(2026, 11, 17),
                )

                # Group B: Carol pays $60 for Carol and David.
                create_expense(
                    db=db,
                    group_id=group_b.id,
                    created_by=carol.id,
                    payer_id=carol.id,
                    participant_ids=[carol.id, david.id],
                    amount="60.00",
                    category="transport",
                    expense_date=date(2026, 11, 17),
                )

                # Verify expense isolation.
                expenses_a = list_expenses(db, group_a.id)
                expenses_b = list_expenses(db, group_b.id)

                assert len(expenses_a) == 1
                assert len(expenses_b) == 1
                assert expenses_a[0]["amount"] == "100.00"
                assert expenses_b[0]["amount"] == "60.00"

                print("Expense group isolation: PASSED")

                # Verify balance isolation.
                balances_a = calculate_balances(db, group_a.id)
                balances_b = calculate_balances(db, group_b.id)

                assert [b["net"] for b in balances_a] == [
                    "50.00", "-50.00"
                ]
                assert [b["net"] for b in balances_b] == [
                    "30.00", "-30.00"
                ]

                print("Balance group isolation: PASSED")

                # Record a settlement in Group B only.
                create_settlement(
                    db=db,
                    group_id=group_b.id,
                    created_by=david.id,
                    from_user_id=david.id,
                    to_user_id=carol.id,
                    amount="10.00",
                    settlement_date=date(2026, 11, 17),
                )

                assert list_settlements(db, group_a.id) == []
                assert len(list_settlements(db, group_b.id)) == 1

                assert [
                    b["net"]
                    for b in calculate_balances(db, group_b.id)
                ] == ["20.00", "-20.00"]

                assert [
                    b["net"]
                    for b in calculate_balances(db, group_a.id)
                ] == ["50.00", "-50.00"]

                print("Settlement group isolation: PASSED")

                # Alice cannot create an expense in Group B.
                with pytest.raises(ExpenseValidationError):
                    create_expense(
                        db=db,
                        group_id=group_b.id,
                        created_by=alice.id,
                        payer_id=carol.id,
                        participant_ids=[carol.id, david.id],
                        amount="20.00",
                        category="groceries",
                        expense_date=date(2026, 11, 17),
                    )

                print("Cross-group expense write: BLOCKED")

                # Alice cannot record a settlement in Group B.
                with pytest.raises(SettlementValidationError):
                    create_settlement(
                        db=db,
                        group_id=group_b.id,
                        created_by=alice.id,
                        from_user_id=david.id,
                        to_user_id=carol.id,
                        amount="10.00",
                        settlement_date=date(2026, 11, 17),
                    )

                print("Cross-group settlement write: BLOCKED")
                print("ALL GROUP ISOLATION TESTS PASSED")

        finally:
            transaction.rollback()
