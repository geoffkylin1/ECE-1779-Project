"""Test atomicity of expense creation using PostgreSQL."""

from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from src.database import engine
from src.expense_service import create_expense
from src.models import (
    Expense,
    ExpenseShare,
    Group,
    Membership,
    User,
)


@pytest.mark.integration
def test_expense_rollback_on_share_failure():
    with engine.connect() as connection:
        outer_transaction = connection.begin()

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

                db.add_all([alice, bob])
                db.flush()

                group = Group(
                    name="Rollback Test Group",
                    join_code=tag[:8].upper(),
                )
                db.add(group)
                db.flush()

                db.add_all([
                    Membership(
                        group_id=group.id,
                        user_id=alice.id,
                    ),
                    Membership(
                        group_id=group.id,
                        user_id=bob.id,
                    ),
                ])
                db.commit()

                group_id = group.id

                def fail_share_insert(
                    conn, cursor, statement,
                    parameters, context, executemany
                ):
                    if "INSERT INTO expense_shares" in statement:
                        raise RuntimeError(
                            "Simulated share insertion failure"
                        )

                # Simulate a database failure when saving shares.
                event.listen(
                    connection,
                    "before_cursor_execute",
                    fail_share_insert,
                )

                try:
                    with pytest.raises(
                        RuntimeError,
                        match="Simulated share insertion failure",
                    ):
                        create_expense(
                            db=db,
                            group_id=group_id,
                            created_by=alice.id,
                            payer_id=alice.id,
                            participant_ids=[alice.id, bob.id],
                            amount="100.00",
                            category="groceries",
                            expense_date=date(2026, 11, 17),
                        )
                finally:
                    event.remove(
                        connection,
                        "before_cursor_execute",
                        fail_share_insert,
                    )

                # Check that no expense was saved.
                expense_count = db.scalar(
                    select(func.count(Expense.id)).where(
                        Expense.group_id == group_id
                    )
                )

                assert expense_count == 0
                print("Expense rollback: PASSED")

                # No orphaned expense shares should remain.
                share_count = db.scalar(
                    select(func.count(ExpenseShare.user_id))
                    .join(
                        Expense,
                        ExpenseShare.expense_id == Expense.id,
                    )
                    .where(Expense.group_id == group_id)
                )

                assert share_count == 0
                print("No orphaned shares: PASSED")
                print("TRANSACTION ROLLBACK TEST PASSED")

        finally:
            outer_transaction.rollback()
