"""Tests for settlement service validation."""

from datetime import date
from unittest.mock import MagicMock

import pytest

from src.settlement_service import (
    SettlementValidationError,
    create_settlement,
)


def make_settlement(db, **overrides):
    data = {
        "db": db,
        "group_id": 1,
        "created_by": 1,
        "from_user_id": 2,
        "to_user_id": 1,
        "amount": "33.33",
        "settlement_date": date(2026, 11, 17),
        "note": None,
    }

    data.update(overrides)
    return create_settlement(**data)


@pytest.mark.parametrize("amount", [
    "0.00",
    "-10.00",
    "12.345",
    "100000000.00",
    "abc",
])
def test_invalid_amount(amount):
    db = MagicMock()

    with pytest.raises(SettlementValidationError):
        make_settlement(db, amount=amount)

    db.add.assert_not_called()


def test_note_too_long():
    db = MagicMock()

    with pytest.raises(SettlementValidationError):
        make_settlement(db, note="a" * 201)

    db.add.assert_not_called()


def test_same_sender_and_receiver():
    db = MagicMock()

    db.scalars.return_value.all.return_value = [1, 2]

    with pytest.raises(SettlementValidationError):
        make_settlement(
            db,
            from_user_id=1,
            to_user_id=1,
        )

    db.add.assert_not_called()


def test_sender_not_member():
    db = MagicMock()

    db.scalars.return_value.all.return_value = [1, 2]

    with pytest.raises(SettlementValidationError):
        make_settlement(db, from_user_id=99)

    db.add.assert_not_called()


def test_receiver_not_member():
    db = MagicMock()

    db.scalars.return_value.all.return_value = [1, 2]

    with pytest.raises(SettlementValidationError):
        make_settlement(db, to_user_id=99)

    db.add.assert_not_called()


def test_creator_not_member():
    db = MagicMock()

    db.scalars.return_value.all.return_value = [1, 2]

    with pytest.raises(SettlementValidationError):
        make_settlement(db, created_by=99)

    db.add.assert_not_called()
