# SplitMate Backend — Database and Core Services

## Overview

This module implements the database schema and core expense-sharing
business logic for SplitMate.

It includes expense creation and listing, equal splitting, balance
calculation, settlement recording, input validation, and database tests.

The FastAPI HTTP endpoints, JWT authentication, and group-management
integration are not included in this module yet.

## Technologies

- Python 3.11
- PostgreSQL 18
- SQLAlchemy 2.x
- Alembic
- Pydantic 2.x
- pytest

## Project Files

| File | Purpose |
|------|---------|
| `src/models.py` | SQLAlchemy models for six database tables |
| `src/database.py` | Database engine and session management |
| `src/split.py` | Equal splitting using integer cents |
| `src/expense_service.py` | Create and list group expenses |
| `src/balance_service.py` | Calculate member net balances |
| `src/settlement_service.py` | Create and list settlements |
| `src/schemas.py` | Pydantic request validation |
| `migrations/` | Alembic migration configuration and revisions |
| `alembic.ini` | Alembic configuration |
| `tests/` | Unit and database integration tests |
| `scripts/smoke_expense.py` | Manual end-to-end database smoke test |
| `pytest.ini` | pytest configuration and integration marker |
| `requirements.txt` | Python dependencies |

## Database Tables

The PostgreSQL database contains six application tables:

1. `users` — Account information and password hashes.
2. `groups` — Shared-expense groups and join codes.
3. `memberships` — User-to-group relationships.
4. `expenses` — Expense information and payer.
5. `expense_shares` — Individual participant shares.
6. `settlements` — Repayment records between group members.

Alembic also creates `alembic_version` for tracking migrations.

## Money Handling

Amounts are represented as decimal strings at the API boundary.

The splitting algorithm converts money to integer cents to avoid
floating-point rounding errors.

Any remaining cents are assigned to participants in ascending
user ID order.

Database amounts are stored using `NUMERIC(12,2)`.

## Balance Calculation

Each member's net balance is calculated as:

    net = total paid
        - total assigned shares
        + settlements sent
        - settlements received

Positive balances indicate money to receive.
Negative balances indicate money owed.

Balances are calculated from records rather than stored separately.

## Local Setup

### 1. Create a Python environment

    python3.11 -m venv .venv
    source .venv/bin/activate
    python -m pip install -r requirements.txt

### 2. Start a local PostgreSQL container

    docker run -d \
      --name splitmate-db-dev \
      -e POSTGRES_USER=splitmate \
      -e POSTGRES_PASSWORD=splitmate_dev_password \
      -e POSTGRES_DB=splitmate \
      -p 127.0.0.1:5433:5432 \
      -v splitmate_pgdata_dev:/var/lib/postgresql \
      postgres:18

If the container already exists but is stopped, use:

    docker start splitmate-db-dev

### 3. Configure DATABASE_URL

Set the following value in a local `.env` file:

    DATABASE_URL=postgresql+psycopg://splitmate:splitmate_dev_password@localhost:5433/splitmate

This password is for local development only.

Never commit `.env` or production secrets.

### 4. Apply database migrations

    alembic upgrade head

### 5. Run tests

Unit tests, without PostgreSQL:

    python -m pytest -m "not integration"

Full test suite, with PostgreSQL running:

    python -m pytest

Manual database smoke test:

    python -m scripts.smoke_expense

## Current Limitations

- HTTP API endpoints are not yet implemented.
- JWT authentication is not yet integrated.
- Group-level read authorization must be enforced by the HTTP layer.
- Services currently manage their own commits and rollbacks.
- Database integration tests require a running PostgreSQL instance.
- Deployment and CI/CD configuration are managed separately.

## API Contract

Implementation should follow `docs/api-contract.md`
once the contract PR is merged.

Core endpoints planned for this module:

- GET /api/groups/{group_id}/expenses
- POST /api/groups/{group_id}/expenses
- GET /api/groups/{group_id}/balances
- GET /api/groups/{group_id}/settlements
- POST /api/groups/{group_id}/settlements
