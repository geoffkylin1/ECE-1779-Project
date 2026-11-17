"""Database operations for SplitMate settlements."""

from datetime import date

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import Membership, Settlement
from src.split import amount_to_cents, cents_to_amount


class SettlementValidationError(ValueError):
    """Invalid settlement business rules."""


def create_settlement(
    db: Session,
    group_id: int,
    created_by: int,
    from_user_id: int,
    to_user_id: int,
    amount: str,
    settlement_date: date,
    note: str | None = None,
) -> Settlement:
    """Record a settlement between two members of a group."""

    # Validate input before database operations.
    if note is not None and len(note) > 200:
        raise SettlementValidationError(
            "Note exceeds 200 characters"
        )

    try:
        amount_cents = amount_to_cents(amount)
        normalized_amount = cents_to_amount(amount_cents)
    except ValueError as exc:
        raise SettlementValidationError(str(exc)) from exc

    # Check group membership.
    member_ids = set(
        db.scalars(
            select(Membership.user_id).where(
                Membership.group_id == group_id
            )
        ).all()
    )

    if created_by not in member_ids:
        raise SettlementValidationError(
            "Creator is not a group member"
        )

    if from_user_id not in member_ids:
        raise SettlementValidationError(
            "Sender is not a group member"
        )

    if to_user_id not in member_ids:
        raise SettlementValidationError(
            "Receiver is not a group member"
        )

    if from_user_id == to_user_id:
        raise SettlementValidationError(
            "Sender and receiver must be different"
        )

    settlement = Settlement(
        group_id=group_id,
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        amount=Decimal(normalized_amount),
        date=settlement_date,
        note=note,
    )

    try:
        db.add(settlement)
        db.commit()
        db.refresh(settlement)

    except Exception:
        db.rollback()
        raise

    return settlement


def list_settlements(
    db: Session,
    group_id: int,
) -> list[dict]:
    """List group settlements, newest first."""

    settlements = db.scalars(
        select(Settlement)
        .where(Settlement.group_id == group_id)
        .order_by(
            Settlement.date.desc(),
            Settlement.created_at.desc(),
            Settlement.id.desc(),
        )
    ).all()

    return [
        {
            "id": settlement.id,
            "from_user_id": settlement.from_user_id,
            "to_user_id": settlement.to_user_id,
            "amount": f"{settlement.amount:.2f}",
            "date": settlement.date.isoformat(),
            "note": settlement.note,
            "created_at": (
                settlement.created_at.isoformat()
                .replace("+00:00", "Z")
            ),
        }
        for settlement in settlements
    ]
