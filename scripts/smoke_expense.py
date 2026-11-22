"""Smoke test expense creation against local PostgreSQL."""

from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.database import engine
from src.expense_service import (
    ExpenseValidationError,
    create_expense,
    list_expenses,
)
from src.models import (
    User,
    Group,
    Membership,
    Expense,
    ExpenseShare,
)
from src.split import cents_to_amount
from src.balance_service import calculate_balances
from src.settlement_service import create_settlement
from src.models import Settlement



def main():
    tag = uuid4().hex[:12]
    user_ids = []
    group_id = None

    with Session(engine) as db:
        try:
            # Create three test users.
            users = [
                User(
                    email=f"{name.lower()}-{tag}@example.com",
                    password_hash="test-only-not-a-real-hash",
                    display_name=name,
                )
                for name in ["Alice", "Bob", "Carol"]
            ]

            db.add_all(users)
            db.flush()

            user_ids = [user.id for user in users]

            # Create a test group.
            group = Group(
                name="Expense Test Group",
                join_code=tag[:8].upper(),
            )
            db.add(group)
            db.flush()
            group_id = group.id

            # Add users to the group.
            for user in users:
                db.add(
                    Membership(
                        group_id=group_id,
                        user_id=user.id,
                    )
                )

            db.commit()

            alice, bob, carol = user_ids

            # Create a $100 expense.
            expense = create_expense(
                db=db,
                group_id=group_id,
                created_by=alice,
                payer_id=alice,
                participant_ids=[alice, bob, carol],
                amount="100.00",
                category="groceries",
                expense_date=date(2026, 11, 17),
                note="Test groceries",
            )

            print("Expense created:", expense.id)

            # Read shares from PostgreSQL.
            shares = db.scalars(
                select(ExpenseShare)
                .where(ExpenseShare.expense_id == expense.id)
                .order_by(ExpenseShare.user_id)
            ).all()

            amounts = [
                cents_to_amount(
                    int(share.amount * 100)
                )
                for share in shares
            ]

            print("Saved shares:", amounts)

            assert amounts == [
                "33.34",
                "33.33",
                "33.33",
            ]

            print("Equal split test: PASSED")

            # Verify expense listing and serialization.
            expenses = list_expenses(
                db=db,
                group_id=group_id,
            )

            assert len(expenses) == 1
            assert expenses[0]["id"] == expense.id
            assert expenses[0]["amount"] == "100.00"
            assert expenses[0]["category"] == "groceries"
            assert [s["amount"] for s in expenses[0]["shares"]] == [
                "33.34", "33.33", "33.33"
            ]

            print("Expense listing test: PASSED")

            # Test category filtering.
            groceries = list_expenses(
                db=db,
                group_id=group_id,
                category="groceries",
            )

            dining = list_expenses(
                db=db,
                group_id=group_id,
                category="dining",
            )

            assert len(groceries) == 1
            assert dining == []

            print("Expense category filter test: PASSED")

            # Test date filtering.
            november_expenses = list_expenses(
                db=db,
                group_id=group_id,
                from_date=date(2026, 11, 1),
                to_date=date(2026, 11, 30),
            )

            december_expenses = list_expenses(
                db=db,
                group_id=group_id,
                from_date=date(2026, 12, 1),
            )

            assert len(november_expenses) == 1
            assert december_expenses == []

            print("Expense date filter test: PASSED")



            # Check balances before repayment.
            balances = calculate_balances(db, group_id)
            assert [b["net"] for b in balances] == [
                "66.66", "-33.33", "-33.33"
            ]
            assert sum(
                Decimal(b["net"]) for b in balances
            ) == Decimal("0.00")

            print("Initial balances: PASSED")

            # Bob repays Alice.
            create_settlement(
                db=db,
                group_id=group_id,
                created_by=bob,
                from_user_id=bob,
                to_user_id=alice,
                amount="33.33",
                settlement_date=date(2026, 11, 17),
                note="Test repayment",
            )

            # Check updated balances.
            balances = calculate_balances(db, group_id)
            assert [b["net"] for b in balances] == [
                "33.33", "0.00", "-33.33"
            ]

            assert sum(
                Decimal(b["net"]) for b in balances
            ) == Decimal("0.00")

            print("Balance after settlement: PASSED")
            print("Full balance and settlement flow: PASSED")

            # Create an outsider who is not a group member.
            outsider = User(
                email=f"outsider-{tag}@example.com",
                password_hash="test-only-not-a-real-hash",
                display_name="Outsider",
            )
            db.add(outsider)
            db.commit()
            db.refresh(outsider)
            user_ids.append(outsider.id)

            # An outsider cannot participate.
            try:
                create_expense(
                    db=db,
                    group_id=group_id,
                    created_by=alice,
                    payer_id=alice,
                    participant_ids=[alice, outsider.id],
                    amount="10.00",
                    category="groceries",
                    expense_date=date(2026, 11, 17),
                )
            except ExpenseValidationError:
                print("Group membership test: PASSED")
            else:
                raise AssertionError(
                    "Outsider was incorrectly accepted"
                )

            print("ALL EXPENSE DATABASE TESTS PASSED")

        finally:
            # Delete only records created by this test.
            db.rollback()

            if group_id is not None:
                for settlement in db.scalars(
                    select(Settlement).where(
                        Settlement.group_id == group_id
                    )
                ).all():
                    db.delete(settlement)

                db.flush()

                test_expenses = db.scalars(
                    select(Expense.id).where(
                        Expense.group_id == group_id
                    )
                ).all()

                for expense_id in test_expenses:
                    for share in db.scalars(
                        select(ExpenseShare).where(
                            ExpenseShare.expense_id == expense_id
                        )
                    ).all():
                        db.delete(share)

                db.flush()

                for expense_id in test_expenses:
                    expense = db.get(Expense, expense_id)
                    if expense:
                        db.delete(expense)

                for member in db.scalars(
                    select(Membership).where(
                        Membership.group_id == group_id
                    )
                ).all():
                    db.delete(member)

                db.flush()

                group = db.get(Group, group_id)
                if group:
                    db.delete(group)

            for user_id in user_ids:
                user = db.get(User, user_id)
                if user:
                    db.delete(user)

            db.commit()
            print("Test data cleaned up")


if __name__ == "__main__":
    main()
