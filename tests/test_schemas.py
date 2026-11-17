"""Tests for API request validation."""

from datetime import date

import pytest
from pydantic import ValidationError

from src.schemas import ExpenseCreate, SettlementCreate


def valid_expense():
    return {
        "amount": "100",
        "payer_id": 1,
        "participant_ids": [1, 2, 3],
        "category": "groceries",
        "date": "2026-11-17",
    }


def test_valid_expense():
    expense = ExpenseCreate(**valid_expense())

    assert expense.amount == "100.00"
    assert expense.date == date(2026, 11, 17)


def test_invalid_amount():
    data = valid_expense()
    data["amount"] = "-100.00"

    with pytest.raises(ValidationError):
        ExpenseCreate(**data)


def test_amount_too_many_decimals():
    data = valid_expense()
    data["amount"] = "12.345"

    with pytest.raises(ValidationError):
        ExpenseCreate(**data)


def test_duplicate_participants():
    data = valid_expense()
    data["participant_ids"] = [1, 1]

    with pytest.raises(ValidationError):
        ExpenseCreate(**data)


def test_invalid_category():
    data = valid_expense()
    data["category"] = "cars"

    with pytest.raises(ValidationError):
        ExpenseCreate(**data)


def test_invalid_date():
    data = valid_expense()
    data["date"] = "2026-13-99"

    with pytest.raises(ValidationError):
        ExpenseCreate(**data)


def test_valid_settlement():
    settlement = SettlementCreate(
        from_user_id=2,
        to_user_id=1,
        amount="33.3",
        date="2026-11-17",
    )

    assert settlement.amount == "33.30"
    assert settlement.note is None


def test_invalid_settlement_amount():
    with pytest.raises(ValidationError):
        SettlementCreate(
            from_user_id=2,
            to_user_id=1,
            amount="0.00",
            date="2026-11-17",
        )
