"""Balance calculation for SplitMate groups."""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import (
    User,
    Membership,
    Expense,
    ExpenseShare,
    Settlement,
)


def calculate_balances(db: Session, group_id: int) -> list[dict]:
    """Calculate each member's net balance in a group."""

    # Step 1: Get all group members.
    members = db.execute(
        select(User.id, User.display_name)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.group_id == group_id)
        .order_by(User.id)
    ).all()

    balances = {
        user_id: Decimal("0.00")
        for user_id, _ in members
    }

    # Step 2: Add amounts paid by each payer.
    expenses = db.scalars(
        select(Expense).where(Expense.group_id == group_id)
    ).all()

    expense_ids = [expense.id for expense in expenses]

    for expense in expenses:
        balances[expense.payer_id] += expense.amount

    # Step 3: Subtract each participant's share.
    if expense_ids:
        shares = db.scalars(
            select(ExpenseShare).where(
                ExpenseShare.expense_id.in_(expense_ids)
            )
        ).all()

        for share in shares:
            balances[share.user_id] -= share.amount

    # Step 4: Apply settlements.
    settlements = db.scalars(
        select(Settlement).where(Settlement.group_id == group_id)
    ).all()

    for settlement in settlements:
        balances[settlement.from_user_id] += settlement.amount
        balances[settlement.to_user_id] -= settlement.amount

    # Step 5: Format results for the API.
    results = [
        {
            "user_id": user_id,
            "display_name": display_name,
            "net": f"{balances[user_id]:.2f}",
        }
        for user_id, display_name in members
    ]

    return results
