"""Pydantic request schemas for SplitMate."""

import re
from datetime import date
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    StrictStr,
    field_validator,
)

from src.split import amount_to_cents, cents_to_amount


Category = Literal[
    "rent",
    "utilities",
    "groceries",
    "transport",
    "dining",
    "entertainment",
    "other",
]


def validate_money(value: str) -> str:
    """Validate and normalize a monetary amount."""
    try:
        return cents_to_amount(amount_to_cents(value))
    except ValueError as exc:
        raise ValueError("Invalid monetary amount") from exc


def validate_date(value: str) -> date:
    """Require a valid YYYY-MM-DD date string."""
    if not isinstance(value, str):
        raise ValueError("Date must be a string")

    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Date must use YYYY-MM-DD")

    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("Invalid calendar date") from exc


class ExpenseCreate(BaseModel):
    """Request body for creating an expense."""

    model_config = ConfigDict(extra="forbid")

    amount: StrictStr
    payer_id: StrictInt = Field(gt=0)
    participant_ids: list[StrictInt] = Field(min_length=1)
    category: Category
    date: date
    note: str | None = Field(default=None, max_length=200)

    @field_validator("amount")
    @classmethod
    def check_amount(cls, value: str) -> str:
        return validate_money(value)

    @field_validator("date", mode="before")
    @classmethod
    def check_date(cls, value):
        return validate_date(value)

    @field_validator("participant_ids")
    @classmethod
    def check_participants(cls, value: list[int]) -> list[int]:
        if any(user_id <= 0 for user_id in value):
            raise ValueError("Participant IDs must be positive")

        if len(value) != len(set(value)):
            raise ValueError("Duplicate participant IDs")

        return value


class SettlementCreate(BaseModel):
    """Request body for recording a settlement."""

    model_config = ConfigDict(extra="forbid")

    from_user_id: StrictInt = Field(gt=0)
    to_user_id: StrictInt = Field(gt=0)
    amount: StrictStr
    date: date
    note: str | None = Field(default=None, max_length=200)

    @field_validator("amount")
    @classmethod
    def check_amount(cls, value: str) -> str:
        return validate_money(value)

    @field_validator("date", mode="before")
    @classmethod
    def check_date(cls, value):
        return validate_date(value)


# Authentication request schemas

from pydantic import EmailStr


class UserRegister(BaseModel):
    """Registration request."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: StrictStr = Field(min_length=8)
    display_name: StrictStr = Field(min_length=1, max_length=30)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_registration_email(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


class UserLogin(BaseModel):
    """Login request."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: StrictStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_login_email(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value


class GroupCreate(BaseModel):
    """Request body for creating a group."""

    model_config = ConfigDict(extra="forbid")

    name: StrictStr = Field(min_length=1, max_length=50)


class GroupJoin(BaseModel):
    """Request body for joining a group."""

    model_config = ConfigDict(extra="forbid")

    join_code: StrictStr

    @field_validator("join_code")
    @classmethod
    def validate_join_code(cls, value: str) -> str:
        normalized = value.upper()

        if not re.fullmatch(r"[A-Z0-9]{8}", normalized):
            raise ValueError(
                "Join code must be 8 letters or digits"
            )

        return normalized
