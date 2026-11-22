# SplitMate Backend

## Overview

The SplitMate backend implements the database schema,
authentication, group management, expense sharing, equal
splitting, balance calculation, and settlement recording.

The FastAPI application provides all 13 HTTP endpoints,
with JWT authentication, group-level access control,
request validation, and PostgreSQL persistence.

## Technologies

- Python 3.11
- FastAPI and Uvicorn
- PostgreSQL 18
- SQLAlchemy 2.x
- Psycopg 3
- Alembic
- Pydantic 2.x
- Argon2 password hashing
- PyJWT
- pytest

## Project Files

| File | Purpose |
|------|---------|
| `src/api.py` | FastAPI application and HTTP endpoints |
| `src/models.py` | SQLAlchemy database models |
| `src/database.py` | Database engine and session management |
| `src/security.py` | Password hashing and JWT handling |
| `src/user_service.py` | User registration and authentication |
| `src/group_service.py` | Group creation, joining, listing, and access control |
| `src/split.py` | Equal splitting using integer cents |
| `src/expense_service.py` | Create and list group expenses |
| `src/balance_service.py` | Calculate member net balances |
| `src/settlement_service.py` | Create and list settlements |
| `src/schemas.py` | Pydantic request validation |
| `migrations/` | Alembic migration configuration and revisions |
| `alembic.ini` | Alembic configuration |
| `tests/` | Unit, database, and HTTP integration tests |
| `scripts/smoke_expense.py` | Database smoke test |
| `scripts/seed_demo.py` | Generate demo data through HTTP APIs |
| `pytest.ini` | pytest configuration |
| `requirements.txt` | Python dependencies |
| `.env.example` | Environment configuration template |

## Database Tables

The PostgreSQL database contains six application tables:

1. `users` — Account information and password hashes.
2. `groups` — Shared-expense groups and join codes.
3. `memberships` — User-to-group relationships.
4. `expenses` — Expense information and payer.
5. `expense_shares` — Individual participant shares.
6. `settlements` — Repayment records between group members.

Alembic also creates `alembic_version` to track migrations.

## API Endpoints

| Method | Endpoint | Authentication |
|--------|----------|----------------|
| GET | `/api/health` | No |
| POST | `/api/auth/register` | No |
| POST | `/api/auth/login` | No |
| GET | `/api/auth/me` | Yes |
| GET | `/api/groups` | Yes |
| POST | `/api/groups` | Yes |
| POST | `/api/groups/join` | Yes |
| GET | `/api/groups/{group_id}` | Group member |
| GET | `/api/groups/{group_id}/expenses` | Group member |
| POST | `/api/groups/{group_id}/expenses` | Group member |
| GET | `/api/groups/{group_id}/balances` | Group member |
| GET | `/api/groups/{group_id}/settlements` | Group member |
| POST | `/api/groups/{group_id}/settlements` | Group member |

See `docs/api-contract.md` for API request and response
formats.

## Authentication and Access Control

- Passwords are hashed using Argon2.
- JWT tokens use HS256 and expire after 60 minutes.
- Protected endpoints require an Authorization header:

      Authorization: Bearer <token>

- Missing or invalid authentication returns HTTP 401.
- Access to another group's data returns HTTP 403.
- Requests for nonexistent groups return HTTP 404.
- JWT configuration is validated at application startup.
- Missing, short, or known placeholder JWT secrets are rejected.
- Validation errors return a JSON object with a string detail.

## Money Handling

Amounts are represented as decimal strings at the API boundary
and stored using PostgreSQL NUMERIC(12,2).

The splitting algorithm converts money to integer cents to
avoid floating-point rounding errors.

Any remaining cents are assigned to participants in ascending
user ID order.

For example, splitting $100.00 among three members produces:

- $33.34
- $33.33
- $33.33

## Balance Calculation

Each member's net balance is calculated as:

    net = total paid
        - total assigned shares
        + settlements sent
        - settlements received

Positive balances indicate money to receive.

Negative balances indicate money owed.

Zero indicates a settled balance.

Balances are calculated from records rather than stored
separately.

## Local Development

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

If the container already exists but is stopped:

    docker start splitmate-db-dev

### 3. Configure environment variables

Use `.env.example` as a configuration template.

Required variables:

    DATABASE_URL=postgresql+psycopg://splitmate:splitmate_dev_password@localhost:5433/splitmate
    JWT_SECRET_KEY=<your-generated-secret>

Generate a strong JWT secret:

    python -c "import secrets; print(secrets.token_urlsafe(48))"

Replace the JWT placeholder with the generated secret.

The database password shown above is for local development
only. Do not use it in production.

Never commit `.env`, JWT secrets, or real credentials.

### 4. Apply database migrations

    alembic upgrade head

### 5. Start the FastAPI server

    python -m uvicorn src.api:app --reload --host 127.0.0.1 --port 8000

Swagger UI:

    http://127.0.0.1:8000/docs

Health check:

    http://127.0.0.1:8000/api/health

## Automated Tests

Run the full test suite:

    python -m pytest -v

Integration tests require a running PostgreSQL database
configured through DATABASE_URL.

Run tests without PostgreSQL integration tests:

    python -m pytest -m "not integration"

Run the manual database smoke test:

    python -m scripts.smoke_expense

Check for missing database migrations:

    alembic check

## Demo Data

With PostgreSQL and the local FastAPI server running:

    python -m scripts.seed_demo

The script creates:

- Three demo users: Alice, Bob, and Carol.
- One shared group.
- One $100.00 expense split among three members.
- One $33.33 settlement from Bob to Alice.

Expected final balances:

| Member | Net balance |
|--------|-------------|
| Alice | 33.33 |
| Bob | 0.00 |
| Carol | -33.33 |

Demo credentials are stored in a Git-ignored local file:

    seed_credentials.*.local.json

Each execution creates a new set of demo records.

Do not commit demo passwords or use local demo credentials
as production credentials.

## Frontend Integration

- Follow `docs/api-contract.md`.
- Send JSON request bodies.
- Send monetary amounts as strings.
- Include JWT bearer tokens for protected requests.
- Use Swagger UI for manual API testing.

## Docker and Cloud Integration

The FastAPI application entrypoint is `src.api:app`.

Container startup command:

    uvicorn src.api:app --host 0.0.0.0 --port 8000

Deployment requirements:

- Configure DATABASE_URL using postgresql+psycopg://.
- Configure a strong JWT_SECRET_KEY.
- Use the same JWT secret across all backend replicas.
- Run alembic upgrade head before accepting requests.
- Persist PostgreSQL data using an appropriate volume.
- Keep deployment credentials outside source control.

The health endpoint returns the backend replica hostname
for load-balancing verification.

## CI/CD Integration

Run pytest for automated backend validation.

Database integration tests require PostgreSQL and applied
Alembic migrations.

Deployment, monitoring, and CI/CD configurations are
maintained separately by the respective team members.

## Current Scope and Limitations

- Expenses are split equally among selected participants.
- Expense and settlement editing or deletion are outside
  the current API scope.
- JWT refresh tokens are not implemented.
- Services currently manage their own commits and rollbacks.
- Full deployment and failure-recovery validation are part
  of team integration.

