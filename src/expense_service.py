"""Database operations for SplitMate expenses."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import Expense, ExpenseShare, Membership
from src.split import (
    equal_split,
    amount_to_cents,
    cents_to_amount,
)


class ExpenseValidationError(ValueError):
    """Invalid expense business rules."""


def create_expense(
    db: Session,
    group_id: int,
    created_by: int,
    payer_id: int,
    participant_ids: list[int],
    amount: str,
    category: str,
    expense_date: date,
    note: str | None = None,
) -> Expense:
    """Create an expense and its shares in one transaction."""

    # Validate expense fields before database operations.
    allowed_categories = {
        "rent",
        "utilities",
        "groceries",
        "transport",
        "dining",
        "entertainment",
        "other",
    }

    if category not in allowed_categories:
        raise ExpenseValidationError("Invalid category")

    if note is not None and len(note) > 200:
        raise ExpenseValidationError("Note exceeds 200 characters")

    try:
        normalized_amount = cents_to_amount(
            amount_to_cents(amount)
        )
        shares = equal_split(amount, participant_ids)
    except ValueError as exc:
        raise ExpenseValidationError(str(exc)) from exc

    # Ensure payer and participants belong to the group.
    member_ids = set(
        db.scalars(
            select(Membership.user_id).where(
                Membership.group_id == group_id
            )
        ).all()
    )

    if created_by not in member_ids:
        raise ExpenseValidationError("Creator is not a group member")

    if payer_id not in member_ids:
        raise ExpenseValidationError("Payer is not a group member")

    if not set(participant_ids).issubset(member_ids):
        raise ExpenseValidationError(
            "All participants must belong to the group"
        )

    expense = Expense(
        group_id=group_id,
        payer_id=payer_id,
        created_by=created_by,
        amount=Decimal(normalized_amount),
        category=category,
        date=expense_date,
        note=note,
    )

    try:
        db.add(expense)
        db.flush()

        for user_id, share_amount in shares.items():
            db.add(
                ExpenseShare(
                    expense_id=expense.id,
                    user_id=user_id,
                    amount=Decimal(share_amount),
                )
            )

        db.commit()
        db.refresh(expense)

    except Exception:
        db.rollback()
        raise

    return expense


def list_expenses(
    db: Session,
    group_id: int,
    from_date: date | None = None,
    to_date: date | None = None,
    category: str | None = None,
) -> list[dict]:
    """List group expenses with their shares, newest first."""

    query = select(Expense).where(Expense.group_id == group_id)

    if from_date is not None:
        query = query.where(Expense.date >= from_date)

    if to_date is not None:
        query = query.where(Expense.date <= to_date)

    if category is not None:
        query = query.where(Expense.category == category)

    query = query.order_by(
        Expense.date.desc(),
        Expense.created_at.desc(),
        Expense.id.desc(),
    )

    expenses = db.scalars(query).all()

    results = []

    for expense in expenses:
        shares = db.scalars(
            select(ExpenseShare)
            .where(ExpenseShare.expense_id == expense.id)
            .order_by(ExpenseShare.user_id)
        ).all()

        results.append({
            "id": expense.id,
            "amount": f"{expense.amount:.2f}",
            "payer_id": expense.payer_id,
            "category": expense.category,
            "date": expense.date.isoformat(),
            "note": expense.note,
            "created_by": expense.created_by,
            "created_at": (
                expense.created_at.isoformat()
                .replace("+00:00", "Z")
            ),
            "shares": [
                {
                    "user_id": share.user_id,
                    "amount": f"{share.amount:.2f}",
                }
                for share in shares
            ],
        })

    return results
