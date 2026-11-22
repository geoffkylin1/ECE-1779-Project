"""Integration tests for user registration and login."""

from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from src.database import engine
from src.models import User
from src.security import verify_password
from src.user_service import (
    UserAlreadyExistsError,
    InvalidCredentialsError,
    authenticate_user,
    get_user_by_id,
    register_user,
)


@pytest.fixture
def db():
    """Provide an isolated PostgreSQL test transaction."""
    with engine.connect() as connection:
        transaction = connection.begin()

        try:
            with Session(
                bind=connection,
                join_transaction_mode="create_savepoint",
                expire_on_commit=False,
            ) as session:
                yield session
        finally:
            transaction.rollback()


@pytest.mark.integration
def test_register_and_login(db):
    email = f"alice-{uuid4().hex}@example.com"

    user = register_user(
        db=db,
        email=f"  {email.upper()}  ",
        password="mypassword123",
        display_name="Alice",
    )

    assert user.id is not None
    assert user.email == email
    assert user.display_name == "Alice"

    # Password must not be stored as plaintext.
    assert user.password_hash != "mypassword123"
    assert verify_password(
        "mypassword123", user.password_hash
    )

    # Confirm that the user was saved to PostgreSQL.
    saved = get_user_by_id(db, user.id)
    assert saved is not None
    assert saved.email == email

    # Correct login.
    logged_in = authenticate_user(
        db, email.upper(), "mypassword123"
    )
    assert logged_in.id == user.id

    # Wrong password.
    with pytest.raises(InvalidCredentialsError):
        authenticate_user(db, email, "wrongpassword")

    # Non-existent account.
    with pytest.raises(InvalidCredentialsError):
        authenticate_user(
            db,
            f"missing-{uuid4().hex}@example.com",
            "mypassword123",
        )


@pytest.mark.integration
def test_duplicate_email(db):
    email = f"bob-{uuid4().hex}@example.com"

    register_user(
        db, email, "mypassword123", "Bob"
    )

    # Normalization must prevent duplicate accounts.
    with pytest.raises(UserAlreadyExistsError):
        register_user(
            db,
            f"  {email.upper()}  ",
            "anotherpassword123",
            "Other Bob",
        )
