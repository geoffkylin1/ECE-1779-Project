# SplitMate API Contract

> **⚠️ DRAFT – needs review by backend owner (Fanyi)**
>
> This is a proposed contract so frontend and backend work can proceed in parallel.
> Nothing here is final until the backend owner signs off. See
> [Open questions for backend owner](#open-questions-for-backend-owner) at the end.

SplitMate is a shared-expense tracker. Backend: FastAPI. Frontend: React.

---

## 1. General rules

### 1.1 Base path and format
- All endpoints are prefixed with `/api`.
- Request and response bodies are JSON (`Content-Type: application/json`).

### 1.2 Authentication
- JWT bearer token sent in the header:
  ```
  Authorization: Bearer <token>
  ```
- Tokens are obtained from `POST /api/auth/login`.
- Tokens are short-lived: **60 minutes** (`expires_in: 3600`).
- **No refresh token.** When the token expires, the API returns `401` and the client must log in again.

### 1.3 Money
- Money is always sent and returned as a **decimal string with exactly 2 decimal places**, e.g. `"12.34"`. Never a JSON number/float.
- Backend stores money as `NUMERIC(12,2)`.
- Splits are computed in **integer cents**. Total cents are divided evenly among participants; any **leftover cents are assigned one each to participants in ascending `user_id` order**.
  - Example: `"100.00"` split among users `1, 2, 3` → 10000 cents / 3 = 3333 r 1 → user 1: `"33.34"`, user 2: `"33.33"`, user 3: `"33.33"`.
- The shares of an expense always sum exactly to the expense amount.

### 1.4 Dates and times
- Dates: `"YYYY-MM-DD"` (e.g. `"2026-11-17"`).
- Timestamps: ISO 8601 in UTC (e.g. `"2026-11-17T18:30:00Z"`).

### 1.5 Errors
All errors use this body:
```json
{ "detail": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad input (semantically invalid, e.g. payer not a member, from == to) |
| 401 | Missing, invalid, or expired token; or wrong login credentials |
| 403 | Authenticated, but not a member of the group |
| 404 | Resource not found |
| 409 | Conflict (e.g. email already registered, already a member) |
| 422 | Validation error (malformed body, wrong types, missing fields) |

### 1.6 Group access control
**Every `/api/groups/{group_id}/...` endpoint (and `GET /api/groups/{group_id}`) returns `403` if the caller is not a member of that group.**

### 1.7 Categories (fixed enum)
```
rent | utilities | groceries | transport | dining | entertainment | other
```

---

## 2. Endpoint summary

| Method | Path | Auth | Success |
|--------|------|------|---------|
| GET  | `/api/health` | No | 200 |
| POST | `/api/auth/register` | No | 201 |
| POST | `/api/auth/login` | No | 200 |
| GET  | `/api/auth/me` | Yes | 200 |
| GET  | `/api/groups` | Yes | 200 |
| POST | `/api/groups` | Yes | 201 |
| POST | `/api/groups/join` | Yes | 200 |
| GET  | `/api/groups/{group_id}` | Yes (member) | 200 |
| GET  | `/api/groups/{group_id}/expenses` | Yes (member) | 200 |
| POST | `/api/groups/{group_id}/expenses` | Yes (member) | 201 |
| GET  | `/api/groups/{group_id}/balances` | Yes (member) | 200 |
| GET  | `/api/groups/{group_id}/settlements` | Yes (member) | 200 |
| POST | `/api/groups/{group_id}/settlements` | Yes (member) | 201 |

---

## 3. Shared object shapes

**User**
```json
{ "id": 1, "email": "alice@example.com", "display_name": "Alice" }
```

**Expense**
```json
{
  "id": 42,
  "amount": "100.00",
  "payer_id": 1,
  "category": "groceries",
  "date": "2026-11-15",
  "note": "Costco run",
  "created_by": 1,
  "created_at": "2026-11-15T21:04:11Z",
  "shares": [
    { "user_id": 1, "amount": "33.34" },
    { "user_id": 2, "amount": "33.33" },
    { "user_id": 3, "amount": "33.33" }
  ]
}
```

**Settlement**
```json
{
  "id": 7,
  "from_user_id": 2,
  "to_user_id": 1,
  "amount": "33.33",
  "date": "2026-11-16",
  "note": "e-transfer",
  "created_at": "2026-11-16T14:20:00Z"
}
```
`from_user_id` is the person paying; `to_user_id` is the person receiving.

---

## 4. Endpoints

### 4.1 Health

#### `GET /api/health`
- **Auth:** No
- **Request body:** none
- **Response 200:**
  ```json
  { "status": "ok", "replica": "splitmate-api-2" }
  ```
  `replica` is the hostname of the backend instance that served the request (useful for verifying load balancing).
- **Errors:** none expected.

---

### 4.2 Auth

#### `POST /api/auth/register`
- **Auth:** No
- **Request body:**
  ```json
  { "email": "alice@example.com", "password": "s3cret-pass", "display_name": "Alice" }
  ```
- **Response 201:** User
  ```json
  { "id": 1, "email": "alice@example.com", "display_name": "Alice" }
  ```
- **Errors:**
  - `409` – email already registered
  - `422` – missing fields, invalid email format

#### `POST /api/auth/login`
- **Auth:** No
- **Request body:**
  ```json
  { "email": "alice@example.com", "password": "s3cret-pass" }
  ```
- **Response 200:**
  ```json
  { "access_token": "eyJhbGciOi...", "token_type": "bearer", "expires_in": 3600 }
  ```
  `expires_in` is in seconds.
- **Errors:**
  - `401` – wrong email or password
  - `422` – missing fields

#### `GET /api/auth/me`
- **Auth:** Yes
- **Request body:** none
- **Response 200:** User
  ```json
  { "id": 1, "email": "alice@example.com", "display_name": "Alice" }
  ```
- **Errors:**
  - `401` – missing/invalid/expired token

---

### 4.3 Groups

#### `GET /api/groups`
List groups the caller belongs to.
- **Auth:** Yes
- **Request body:** none
- **Response 200:**
  ```json
  [
    { "id": 10, "name": "Apartment 4B", "member_count": 3 },
    { "id": 11, "name": "Ski Trip", "member_count": 5 }
  ]
  ```
  Empty array `[]` if the caller is in no groups.
- **Errors:**
  - `401` – missing/invalid token

#### `POST /api/groups`
Create a group. The caller automatically becomes its first member.
- **Auth:** Yes
- **Request body:**
  ```json
  { "name": "Apartment 4B" }
  ```
- **Response 201:**
  ```json
  { "id": 10, "name": "Apartment 4B", "join_code": "K7Q2ZP", "created_at": "2026-11-17T18:30:00Z" }
  ```
- **Errors:**
  - `401` – missing/invalid token
  - `422` – missing/empty name

#### `POST /api/groups/join`
Join an existing group using its join code.
- **Auth:** Yes
- **Request body:**
  ```json
  { "join_code": "K7Q2ZP" }
  ```
- **Response 200:** Group (same shape as `GET /api/groups/{group_id}`)
  ```json
  {
    "id": 10,
    "name": "Apartment 4B",
    "join_code": "K7Q2ZP",
    "members": [
      { "user_id": 1, "display_name": "Alice" },
      { "user_id": 2, "display_name": "Bob" }
    ]
  }
  ```
- **Errors:**
  - `401` – missing/invalid token
  - `404` – no group with this join code
  - `409` – caller is already a member
  - `422` – missing join_code

#### `GET /api/groups/{group_id}`
- **Auth:** Yes (member)
- **Request body:** none
- **Response 200:**
  ```json
  {
    "id": 10,
    "name": "Apartment 4B",
    "join_code": "K7Q2ZP",
    "members": [
      { "user_id": 1, "display_name": "Alice" },
      { "user_id": 2, "display_name": "Bob" },
      { "user_id": 3, "display_name": "Carol" }
    ]
  }
  ```
- **Errors:**
  - `401` – missing/invalid token
  - `403` – caller is not a member
  - `404` – group does not exist

---

### 4.4 Expenses

#### `GET /api/groups/{group_id}/expenses`
List expenses in a group, **newest first**.
- **Auth:** Yes (member)
- **Query parameters (all optional):**
  | Param | Format | Meaning |
  |-------|--------|---------|
  | `from` | `YYYY-MM-DD` | Only expenses with `date >= from` |
  | `to` | `YYYY-MM-DD` | Only expenses with `date <= to` |
  | `category` | category enum | Only expenses in this category |

  Example: `GET /api/groups/10/expenses?from=2026-11-01&to=2026-11-30&category=groceries`
- **Response 200:** array of Expense
  ```json
  [
    {
      "id": 42,
      "amount": "100.00",
      "payer_id": 1,
      "category": "groceries",
      "date": "2026-11-15",
      "note": "Costco run",
      "created_by": 1,
      "created_at": "2026-11-15T21:04:11Z",
      "shares": [
        { "user_id": 1, "amount": "33.34" },
        { "user_id": 2, "amount": "33.33" },
        { "user_id": 3, "amount": "33.33" }
      ]
    }
  ]
  ```
- **Errors:**
  - `401` – missing/invalid token
  - `403` – caller is not a member
  - `404` – group does not exist
  - `422` – malformed date or unknown category

#### `POST /api/groups/{group_id}/expenses`
Record an expense, split evenly among participants (see §1.3).
- **Auth:** Yes (member)
- **Request body:**
  ```json
  {
    "amount": "100.00",
    "payer_id": 1,
    "participant_ids": [1, 2, 3],
    "category": "groceries",
    "date": "2026-11-15",
    "note": "Costco run"
  }
  ```
  `note` is optional.
- **Rules:**
  - `amount` > `"0.00"`.
  - `payer_id` must be a group member.
  - `participant_ids` must contain at least one user, all of whom are group members.
  - `category` must be one of the enum values.
  - `created_by` is set by the server to the caller.
- **Response 201:** Expense (see example in §3).
- **Errors:**
  - `400` – payer or a participant is not a group member; amount ≤ 0
  - `401` – missing/invalid token
  - `403` – caller is not a member
  - `404` – group does not exist
  - `422` – missing fields, wrong types, empty `participant_ids`, bad date, unknown category, malformed amount

---

### 4.5 Balances

#### `GET /api/groups/{group_id}/balances`
Net position of each member, accounting for all expenses and settlements.
- **Auth:** Yes (member)
- **Request body:** none
- **Semantics:**
  - `net > 0` → this member should **receive** money.
  - `net < 0` → this member **owes** money.
  - The sum of all `net` values is exactly `"0.00"`.
  - Proposed computation: `net = (total paid as payer) − (total of own shares) + (settlements paid as from_user) − (settlements received as to_user)`.
- **Response 200:**
  ```json
  [
    { "user_id": 1, "display_name": "Alice", "net": "66.66" },
    { "user_id": 2, "display_name": "Bob",   "net": "-33.33" },
    { "user_id": 3, "display_name": "Carol", "net": "-33.33" }
  ]
  ```
- **Errors:**
  - `401` – missing/invalid token
  - `403` – caller is not a member
  - `404` – group does not exist

---

### 4.6 Settlements

#### `GET /api/groups/{group_id}/settlements`
List settlements (payments between members), **newest first**.
- **Auth:** Yes (member)
- **Request body:** none
- **Response 200:** array of Settlement
  ```json
  [
    {
      "id": 7,
      "from_user_id": 2,
      "to_user_id": 1,
      "amount": "33.33",
      "date": "2026-11-16",
      "note": "e-transfer",
      "created_at": "2026-11-16T14:20:00Z"
    }
  ]
  ```
- **Errors:**
  - `401` – missing/invalid token
  - `403` – caller is not a member
  - `404` – group does not exist

#### `POST /api/groups/{group_id}/settlements`
Record that one member paid another.
- **Auth:** Yes (member)
- **Request body:**
  ```json
  { "from_user_id": 2, "to_user_id": 1, "amount": "33.33", "date": "2026-11-16", "note": "e-transfer" }
  ```
  `note` is optional.
- **Rules:**
  - `from_user_id != to_user_id`.
  - Both users must be group members.
  - `amount` > `"0.00"`.
- **Response 201:** Settlement (see example in §3).
- **Errors:**
  - `400` – from == to; either user is not a member; amount ≤ 0
  - `401` – missing/invalid token
  - `403` – caller is not a member
  - `404` – group does not exist
  - `422` – missing fields, wrong types, bad date, malformed amount

---

## Open questions for backend owner

1. **422 error format vs. `{"detail": "message"}`.** FastAPI's default 422 response has `detail` as a *list* of objects (`[{loc, msg, type}]`), not a string. Should we override the validation handler so every error has a string `detail`, or should the frontend handle both shapes?
2. **400 vs. 422 boundary.** Which errors are 400 and which are 422? This draft uses 422 for schema/type problems (Pydantic) and 400 for business rules (non-member payer, from == to). Is `amount <= 0` a 400 or a 422?
3. **Login body format.** Is login JSON (`{email, password}`) as drafted here, or form-encoded via `OAuth2PasswordRequestForm` (which uses `username` instead of `email`)?
4. **Non-existent group: 403 or 404?** If `group_id` doesn't exist, do we return 404, or 403 for everything so non-members can't probe which group IDs exist?
5. **Joining a group you're already in.** Return `409` (as drafted), or `200` with the group (idempotent)? And is the join response `200` or `201`?
6. **Join code details.** What format and length, is it case-sensitive, is it unique, and can it be regenerated? Should every member be able to see it via `GET /api/groups/{group_id}`?
7. **Money input strictness.** Must `amount` have exactly two decimals (`"12.30"`), or is `"12.3"` / `"12"` accepted and normalized? What is the maximum (NUMERIC(12,2) allows up to `9999999999.99`)? Is a JSON number rejected with 422?
8. **Duplicate or odd participants.** Is a duplicate in `participant_ids` (e.g. `[1, 1, 2]`) a 400/422 or silently de-duplicated? Is it allowed for the payer *not* to be a participant (paying on behalf of others)?
9. **Who can record what.** Can any member create an expense with *another* member as payer, or record a settlement between two *other* members? (This draft allows both.)
10. **Edit/delete.** There are no endpoints to edit or delete expenses or settlements, or to leave a group or remove a member. Are these out of scope for v1?
11. **Ordering ties.** "Newest first" sorts by `date` descending, but what is the tie-breaker for items on the same date: `created_at` descending, then `id` descending?
12. **Filter edge cases.** Are `from` and `to` inclusive (as drafted)? What happens if `from > to`: an empty list, or 400? Does an unknown `category` return 422, or an empty list?
13. **Pagination.** Expense and settlement lists aren't paginated. Is that acceptable for v1, or should we add `limit`/`offset` now?
14. **Balances details.** Are members with `net = "0.00"` included (as drafted)? What is the sort order (by `user_id`)? Please confirm the sign convention for settlements in the net formula in §4.5.
15. **Overpaying a settlement.** Can a settlement be larger than what `from_user` currently owes (flipping the balance sign), or is that a 400?
16. **IDs.** Are IDs integers (as drafted) or UUIDs? This affects the "leftover cents in ascending `user_id`" rule.
17. **Field constraints.** What are the max lengths for `name`, `display_name`, and `note`? What is the minimum password length? Are emails normalized to lowercase so `Alice@x.com` and `alice@x.com` conflict?
18. **`note` when absent.** Is it returned as `null` or `""`?
19. **JWT details.** What claim holds the user ID (`sub`)? What is the signing algorithm (HS256)? Is a token for a deleted user rejected with 401?
20. **`replica` in health.** Is it OK to expose the container hostname publicly, or should it be hidden or only enabled in non-prod?
