"""Equal split calculations using integer cents."""

import re
from decimal import Decimal


MAX_CENTS = 9_999_999_999


def amount_to_cents(amount: str) -> int:
    """Convert a decimal money string into integer cents."""
    if not isinstance(amount, str):
        raise ValueError("Amount must be a string")

    if not re.fullmatch(r"\d+(\.\d{1,2})?", amount):
        raise ValueError("Invalid amount format")

    value = Decimal(amount)
    cents = int(value * 100)

    if cents <= 0 or cents > MAX_CENTS:
        raise ValueError("Amount out of allowed range")

    return cents


def cents_to_amount(cents: int) -> str:
    """Convert integer cents into a two-decimal string."""
    sign = "-" if cents < 0 else ""
    absolute = abs(cents)
    return f"{sign}{absolute // 100}.{absolute % 100:02d}"


def equal_split(amount: str, participant_ids: list[int]) -> dict[int, str]:
    """Divide an amount equally, assigning leftovers by ascending user ID."""
    if not participant_ids:
        raise ValueError("Participants cannot be empty")

    if len(participant_ids) != len(set(participant_ids)):
        raise ValueError("Duplicate participants")

    if any(type(user_id) is not int or user_id <= 0 for user_id in participant_ids):
        raise ValueError("Invalid participant ID")

    total_cents = amount_to_cents(amount)
    ordered_ids = sorted(participant_ids)

    base_share, remainder = divmod(total_cents, len(ordered_ids))

    return {
        user_id: cents_to_amount(base_share + (index < remainder))
        for index, user_id in enumerate(ordered_ids)
    }
