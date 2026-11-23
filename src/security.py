"""Password hashing and JWT helpers for SplitMate."""

from datetime import datetime, timedelta, timezone

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash


password_hash = PasswordHash.recommended()

JWT_ALGORITHM = "HS256"
TOKEN_LIFETIME_MINUTES = 60


def hash_password(password: str) -> str:
    """Hash a password securely."""
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Check a password against its hash."""
    return password_hash.verify(password, hashed)


def create_access_token(user_id: int, secret_key: str) -> str:
    """Create a JWT containing the user ID."""
    if len(secret_key) < 32:
        raise ValueError("JWT secret must be at least 32 characters")

    expires = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_LIFETIME_MINUTES
    )

    return jwt.encode(
        {
            "sub": str(user_id),
            "exp": expires,
        },
        secret_key,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str, secret_key: str) -> int:
    """Verify a JWT and return its user ID."""
    try:
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )

        user_id = payload["sub"]

        if not isinstance(user_id, str) or not user_id.isdecimal():
            raise ValueError("Invalid user ID")

        result = int(user_id)

        if result <= 0:
            raise ValueError("Invalid user ID")

        return result

    except (InvalidTokenError, ValueError, TypeError, KeyError) as exc:
        raise ValueError("Invalid or expired token") from exc
