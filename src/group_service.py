"""Group management database operations for SplitMate."""

import secrets
import string

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.models import Group, Membership, User


class GroupNotFoundError(ValueError):
    pass


class GroupAccessError(ValueError):
    pass


class AlreadyMemberError(ValueError):
    pass


JOIN_CODE_CHARS = string.ascii_uppercase + string.digits


def generate_join_code(db: Session) -> str:
    """Generate a unique 8-character join code."""
    for _ in range(10):
        code = "".join(
            secrets.choice(JOIN_CODE_CHARS) for _ in range(8)
        )

        existing = db.scalar(
            select(Group.id).where(Group.join_code == code)
        )

        if existing is None:
            return code

    raise RuntimeError("Unable to generate a unique join code")


def is_group_member(
    db: Session, group_id: int, user_id: int
) -> bool:
    """Check whether a user belongs to a group."""
    return db.get(Membership, (group_id, user_id)) is not None


def create_group(
    db: Session, user_id: int, name: str
) -> Group:
    """Create a group and add the creator as its first member."""
    if not isinstance(name, str) or not 1 <= len(name) <= 50:
        raise ValueError("Group name must contain 1-50 characters")

    group = Group(
        name=name,
        join_code=generate_join_code(db),
    )

    try:
        db.add(group)
        db.flush()

        db.add(
            Membership(group_id=group.id, user_id=user_id)
        )

        db.commit()
        db.refresh(group)
    except Exception:
        db.rollback()
        raise

    return group


def get_group(
    db: Session, group_id: int, user_id: int
) -> dict:
    """Return group details after checking membership."""
    group = db.get(Group, group_id)

    if group is None:
        raise GroupNotFoundError("Group not found")

    if not is_group_member(db, group_id, user_id):
        raise GroupAccessError("Not a member of this group")

    members = db.execute(
        select(User.id, User.display_name)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.group_id == group_id)
        .order_by(User.id)
    ).all()

    return {
        "id": group.id,
        "name": group.name,
        "join_code": group.join_code,
        "members": [
            {"user_id": uid, "display_name": display_name}
            for uid, display_name in members
        ],
    }


def list_groups(db: Session, user_id: int) -> list[dict]:
    """List groups belonging to the current user."""
    groups = db.scalars(
        select(Group)
        .join(Membership, Membership.group_id == Group.id)
        .where(Membership.user_id == user_id)
        .order_by(Group.id)
    ).all()

    results = []

    for group in groups:
        count = db.scalar(
            select(func.count())
            .select_from(Membership)
            .where(Membership.group_id == group.id)
        )

        results.append({
            "id": group.id,
            "name": group.name,
            "join_code": group.join_code,
            "member_count": count,
        })

    return results


def join_group(
    db: Session, user_id: int, join_code: str
) -> dict:
    """Join a group using a case-insensitive join code."""
    normalized_code = join_code.upper()

    group = db.scalar(
        select(Group).where(
            Group.join_code == normalized_code
        )
    )

    if group is None:
        raise GroupNotFoundError("Join code not found")

    if is_group_member(db, group.id, user_id):
        raise AlreadyMemberError("Already a group member")

    try:
        db.add(
            Membership(group_id=group.id, user_id=user_id)
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_group(db, group.id, user_id)
