"""Tests for expense service input validation."""

from datetime import date
from unittest.mock import MagicMock

import pytest

from src.expense_service import (
    ExpenseValidationError,
    create_expense,
)


def make_expense(db, **overrides):
    data = {
        "db": db,
        "group_id": 1,
        "created_by": 1,
        "payer_id": 1,
        "participant_ids": [1, 2],
        "amount": "100.00",
        "category": "groceries",
        "expense_date": date(2026, 11, 17),
    }

    data.update(overrides)
    return create_expense(**data)


@pytest.mark.parametrize("amount", [
    "0.00",
    "-10.00",
    "12.345",
    "100000000.00",
])
def test_invalid_amount(amount):
    db = MagicMock()

    with pytest.raises(ExpenseValidationError):
        make_expense(db, amount=amount)

    db.add.assert_not_called()


def test_invalid_category():
    db = MagicMock()

    with pytest.raises(ExpenseValidationError):
        make_expense(db, category="cars")

    db.add.assert_not_called()


def test_note_too_long():
    db = MagicMock()

    with pytest.raises(ExpenseValidationError):
        make_expense(db, note="a" * 201)

    db.add.assert_not_called()


def test_duplicate_participants():
    db = MagicMock()

    with pytest.raises(ExpenseValidationError):
        make_expense(db, participant_ids=[1, 1])

    db.add.assert_not_called()
