"""Tests for password hashing and JWT authentication."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from src.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


TEST_SECRET = "test-secret-for-unit-tests-only-1234567890"


def test_password_hashing():
    hashed = hash_password("mypassword123")

    assert hashed != "mypassword123"
    assert verify_password("mypassword123", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_password_hash_uses_salt():
    first = hash_password("mypassword123")
    second = hash_password("mypassword123")

    assert first != second


def test_jwt_token():
    token = create_access_token(42, TEST_SECRET)

    assert decode_access_token(token, TEST_SECRET) == 42


def test_invalid_token():
    with pytest.raises(ValueError):
        decode_access_token("invalid-token", TEST_SECRET)


def test_expired_token():
    expired = jwt.encode(
        {
            "sub": "42",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=5),
        },
        TEST_SECRET,
        algorithm="HS256",
    )

    with pytest.raises(ValueError):
        decode_access_token(expired, TEST_SECRET)


def test_wrong_secret():
    token = create_access_token(42, TEST_SECRET)

    with pytest.raises(ValueError):
        decode_access_token(
            token,
            "different-test-secret-123456789012345",
        )
