"""SplitMate FastAPI application."""

import os
import socket

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from sqlalchemy.orm import Session

from src.database import get_db
from src.models import User
from src.schemas import UserLogin, UserRegister
from src.security import (
    create_access_token,
    decode_access_token,
)
from src.user_service import (
    InvalidCredentialsError,
    UserAlreadyExistsError,
    authenticate_user,
    get_user_by_id,
    register_user,
)

load_dotenv()

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate required security configuration at startup."""
    get_jwt_secret()
    yield


app = FastAPI(
    title="SplitMate API",
    version="1.0.0",
    lifespan=lifespan,
)

bearer_scheme = HTTPBearer(auto_error=False)


def get_jwt_secret() -> str:
    """Load the JWT signing secret."""
    secret = os.getenv("JWT_SECRET_KEY")

    if (
        not secret
        or len(secret) < 32
        or secret == "replace-with-a-secure-random-secret"
    ):
        raise RuntimeError(
            "JWT_SECRET_KEY must be configured securely"
        )

    return secret


def user_response(user: User) -> dict:
    """Serialize public user information."""
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate a request using its JWT bearer token."""

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid authentication token",
        )

    try:
        user_id = decode_access_token(
            credentials.credentials,
            get_jwt_secret(),
        )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token",
        )

    user = get_user_by_id(db, user_id)

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User no longer exists",
        )

    return user


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    """Return string details instead of FastAPI's default list."""
    errors = exc.errors()
    message = errors[0].get("msg", "Invalid request") if errors else "Invalid request"

    return JSONResponse(
        status_code=422,
        content={"detail": str(message).removeprefix("Value error, ")},
    )


@app.get("/api/health")
def health():
    """Return health status and backend replica hostname."""
    return {
        "status": "ok",
        "replica": socket.gethostname(),
    }


@app.post("/api/auth/register", status_code=201)
def register(
    data: UserRegister,
    db: Session = Depends(get_db),
):
    """Register a new user."""
    try:
        user = register_user(
            db=db,
            email=str(data.email),
            password=data.password,
            display_name=data.display_name,
        )
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    return user_response(user)


@app.post("/api/auth/login")
def login(
    data: UserLogin,
    db: Session = Depends(get_db),
):
    """Authenticate credentials and issue a JWT."""
    try:
        user = authenticate_user(
            db=db,
            email=str(data.email),
            password=data.password,
        )
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_access_token(
        user.id,
        get_jwt_secret(),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 3600,
    }


@app.get("/api/auth/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user."""
    return user_response(current_user)


# ---------------------------------------------------------
# Group Management HTTP Endpoints
# ---------------------------------------------------------

from src.schemas import GroupCreate, GroupJoin
from src.group_service import (
    AlreadyMemberError,
    GroupAccessError,
    GroupNotFoundError,
    create_group,
    get_group,
    join_group,
    list_groups,
)


@app.post("/api/groups", status_code=201)
def api_create_group(
    data: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a group and add the current user as a member."""
    group = create_group(
        db=db,
        user_id=current_user.id,
        name=data.name,
    )

    result = get_group(db, group.id, current_user.id)
    from datetime import timezone
    result["created_at"] = (
        group.created_at.astimezone(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )
    return result


@app.post("/api/groups/join")
def api_join_group(
    data: GroupJoin,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Join a group using its invitation code."""
    try:
        return join_group(
            db=db,
            user_id=current_user.id,
            join_code=data.join_code,
        )
    except GroupNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Join code not found",
        )
    except AlreadyMemberError:
        raise HTTPException(
            status_code=409,
            detail="Already a group member",
        )


@app.get("/api/groups")
def api_list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List groups belonging to the authenticated user."""
    return list_groups(db, current_user.id)


@app.get("/api/groups/{group_id}")
def api_get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a group and its members."""
    try:
        return get_group(
            db=db,
            group_id=group_id,
            user_id=current_user.id,
        )
    except GroupNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Group not found",
        )
    except GroupAccessError:
        raise HTTPException(
            status_code=403,
            detail="Not a member of this group",
        )


# ---------------------------------------------------------
# Expense, Balance, and Settlement HTTP Endpoints
# ---------------------------------------------------------

from datetime import date as Date
from fastapi import Query

from src.models import Group
from src.schemas import ExpenseCreate, SettlementCreate
from src.expense_service import (
    create_expense,
    list_expenses,
)
from src.balance_service import calculate_balances
from src.settlement_service import (
    create_settlement,
    list_settlements,
)
from src.group_service import is_group_member


def require_group_member(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> int:
    """Enforce group existence and membership before data access."""

    group = db.get(Group, group_id)

    if group is None:
        raise HTTPException(
            status_code=404,
            detail="Group not found",
        )

    if not is_group_member(db, group_id, current_user.id):
        raise HTTPException(
            status_code=403,
            detail="Not a member of this group",
        )

    return group_id


@app.get("/api/groups/{group_id}/expenses")
def api_list_expenses(
    group_id: int = Depends(require_group_member),
    from_date: Date | None = Query(default=None, alias="from"),
    to_date: Date | None = Query(default=None, alias="to"),
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """List expenses with optional date and category filters."""

    valid_categories = {
        "rent", "utilities", "groceries",
        "transport", "dining", "entertainment", "other",
    }

    if category is not None and category not in valid_categories:
        raise HTTPException(
            status_code=422,
            detail="Invalid expense category",
        )

    if (
        from_date is not None
        and to_date is not None
        and from_date > to_date
    ):
        return []

    return list_expenses(
        db=db,
        group_id=group_id,
        from_date=from_date,
        to_date=to_date,
        category=category,
    )


@app.post("/api/groups/{group_id}/expenses", status_code=201)
def api_create_expense(
    data: ExpenseCreate,
    group_id: int = Depends(require_group_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record an expense and divide its amount equally."""

    member_ids = [data.payer_id, *data.participant_ids]

    if not all(
        is_group_member(db, group_id, user_id)
        for user_id in member_ids
    ):
        raise HTTPException(
            status_code=400,
            detail="Payer and participants must be group members",
        )

    try:
        expense = create_expense(
            db=db,
            group_id=group_id,
            created_by=current_user.id,
            payer_id=data.payer_id,
            participant_ids=data.participant_ids,
            amount=data.amount,
            category=data.category,
            expense_date=data.date,
            note=data.note,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    # Reuse the existing Expense serializer.
    expenses = list_expenses(db=db, group_id=group_id)

    return next(
        item for item in expenses
        if item["id"] == expense.id
    )


@app.get("/api/groups/{group_id}/balances")
def api_get_balances(
    group_id: int = Depends(require_group_member),
    db: Session = Depends(get_db),
):
    """Calculate each group member's net position."""

    return calculate_balances(
        db=db,
        group_id=group_id,
    )


@app.get("/api/groups/{group_id}/settlements")
def api_list_settlements(
    group_id: int = Depends(require_group_member),
    db: Session = Depends(get_db),
):
    """List settlements for an authenticated group member."""

    return list_settlements(
        db=db,
        group_id=group_id,
    )


@app.post("/api/groups/{group_id}/settlements", status_code=201)
def api_create_settlement(
    data: SettlementCreate,
    group_id: int = Depends(require_group_member),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a payment between two group members."""

    if data.from_user_id == data.to_user_id:
        raise HTTPException(
            status_code=400,
            detail="Sender and receiver must be different",
        )

    if not all(
        is_group_member(db, group_id, user_id)
        for user_id in (data.from_user_id, data.to_user_id)
    ):
        raise HTTPException(
            status_code=400,
            detail="Both users must be group members",
        )

    try:
        settlement = create_settlement(
            db=db,
            group_id=group_id,
            created_by=current_user.id,
            from_user_id=data.from_user_id,
            to_user_id=data.to_user_id,
            amount=data.amount,
            settlement_date=data.date,
            note=data.note,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    # Reuse the existing Settlement serializer.
    settlements = list_settlements(db=db, group_id=group_id)

    return next(
        item for item in settlements
        if item["id"] == settlement.id
    )
