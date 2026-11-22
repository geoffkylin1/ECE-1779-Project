"""Unit tests for balance calculations."""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

from src.balance_service import calculate_balances
from src.models import Expense, ExpenseShare, Settlement


def test_balance_from_single_expense():
    db = MagicMock()

    # Query 1: group members.
    members = [
        (1, "Alice"),
        (2, "Bob"),
        (3, "Carol"),
    ]

    # Query 2: expenses.
    expense = Expense(
        id=42,
        group_id=10,
        payer_id=1,
        created_by=1,
        amount=Decimal("100.00"),
        category="groceries",
        date=date(2026, 11, 17),
    )

    # Query 3: shares.
    shares = [
        ExpenseShare(
            expense_id=42,
            user_id=1,
            amount=Decimal("33.34"),
        ),
        ExpenseShare(
            expense_id=42,
            user_id=2,
            amount=Decimal("33.33"),
        ),
        ExpenseShare(
            expense_id=42,
            user_id=3,
            amount=Decimal("33.33"),
        ),
    ]

    # Query 4: no settlements.
    db.execute.return_value.all.return_value = members
    db.scalars.return_value.all.side_effect = [
        [expense],
        shares,
        [],
    ]

    result = calculate_balances(db, group_id=10)

    assert result == [
        {"user_id": 1, "display_name": "Alice", "net": "66.66"},
        {"user_id": 2, "display_name": "Bob", "net": "-33.33"},
        {"user_id": 3, "display_name": "Carol", "net": "-33.33"},
    ]


def test_balance_with_settlement():
    db = MagicMock()

    members = [
        (1, "Alice"),
        (2, "Bob"),
        (3, "Carol"),
    ]

    expense = Expense(
        id=42,
        group_id=10,
        payer_id=1,
        created_by=1,
        amount=Decimal("100.00"),
        category="groceries",
        date=date(2026, 11, 17),
    )

    shares = [
        ExpenseShare(expense_id=42, user_id=1, amount=Decimal("33.34")),
        ExpenseShare(expense_id=42, user_id=2, amount=Decimal("33.33")),
        ExpenseShare(expense_id=42, user_id=3, amount=Decimal("33.33")),
    ]

    settlement = Settlement(
        id=7,
        group_id=10,
        from_user_id=2,
        to_user_id=1,
        amount=Decimal("33.33"),
        date=date(2026, 11, 17),
    )

    db.execute.return_value.all.return_value = members
    db.scalars.return_value.all.side_effect = [
        [expense],
        shares,
        [settlement],
    ]

    result = calculate_balances(db, group_id=10)

    assert result == [
        {"user_id": 1, "display_name": "Alice", "net": "33.33"},
        {"user_id": 2, "display_name": "Bob", "net": "0.00"},
        {"user_id": 3, "display_name": "Carol", "net": "-33.33"},
    ]
