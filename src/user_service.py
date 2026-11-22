"""User registration and login database operations."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.models import User
from src.security import hash_password, verify_password


class UserAlreadyExistsError(ValueError):
    """Email is already registered."""


class InvalidCredentialsError(ValueError):
    """Email or password is incorrect."""


def normalize_email(email: str) -> str:
    """Normalize email for storage and lookup."""
    return email.strip().lower()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Retrieve a user by primary key."""
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    """Find a user using normalized email."""
    return db.scalar(
        select(User).where(
            User.email == normalize_email(email)
        )
    )


def register_user(
    db: Session,
    email: str,
    password: str,
    display_name: str,
) -> User:
    """Register a new user with a securely hashed password."""

    normalized_email = normalize_email(email)

    if get_user_by_email(db, normalized_email) is not None:
        raise UserAlreadyExistsError("Email already registered")

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        display_name=display_name,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise UserAlreadyExistsError(
            "Email already registered"
        ) from exc
    except Exception:
        db.rollback()
        raise

    return user


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User:
    """Authenticate a user by email and password."""

    user = get_user_by_email(db, email)

    if user is None:
        raise InvalidCredentialsError(
            "Invalid email or password"
        )

    if not verify_password(password, user.password_hash):
        raise InvalidCredentialsError(
            "Invalid email or password"
        )

    return user
