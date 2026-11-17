# SplitMate API Contract

> **⚠️ DRAFT – needs review by backend owner (Fanyi)**
>
> This is a proposed contract so frontend and backend work can proceed in parallel.
> The decisions in [Proposed decisions](#proposed-decisions-accepted-unless-backend-owner-objects)
> at the end are **accepted unless the backend owner objects**, and the rest of this
> document already reflects them.

SplitMate is a shared-expense tracker. Backend: FastAPI. Frontend: React.

---

## 1. General rules

### 1.1 Base path and format
- All endpoints are prefixed with `/api`.
- Request and response bodies are JSON (`Content-Type: application/json`). This includes login (no OAuth2 form encoding).

### 1.2 Authentication
- JWT bearer token sent in the header:
  ```
  Authorization: Bearer <token>
  ```
- Tokens are obtained from `POST /api/auth/login`.
- JWT details:
  - Algorithm: **HS256**
  - `sub` claim: the user's id **as a string** (e.g. `"1"`)
  - Lifetime: **60 minutes** (`expires_in: 3600`)
- **No refresh token.** When the token expires, the API returns `401` and the client must log in again.
- A validly signed token whose user no longer exists → `401`.

### 1.3 Money
- Money is always returned as a **decimal string with exactly 2 decimal places**, e.g. `"12.34"`. Never a JSON number/float.
- Clients send money as a string. Accepted input: `"12"`, `"12.3"`, `"12.30"`, all normalized to `"12.30"`.
  - More than 2 decimal places (e.g. `"12.345"`) → `422`.
  - Amount must be > `"0.00"`; otherwise `422`.
  - Maximum: `"99999999.99"`; above that → `422`.
- Backend stores money as `NUMERIC(12,2)`.
- Splits are computed in **integer cents**. Total cents are divided evenly among participants; any **leftover cents are assigned one each to participants in ascending `user_id` order**.
  - Example: `"100.00"` split among users `1, 2, 3` → 10000 cents / 3 = 3333 r 1 → user 1: `"33.34"`, user 2: `"33.33"`, user 3: `"33.33"`.
- The shares of an expense always sum exactly to the expense amount.

### 1.4 Dates and times
- Dates: `"YYYY-MM-DD"` (e.g. `"2026-11-17"`). Malformed dates → `422`.
- Timestamps: ISO 8601 in UTC (e.g. `"2026-11-17T18:30:00Z"`).

### 1.5 Errors
**Every** error, including validation errors, uses this body with a **string** `detail`:
```json
{ "detail": "Human-readable message" }
```
The backend overrides FastAPI's default validation handler (which would otherwise return `detail` as a list). The frontend still tolerates the list shape defensively.

| Status | Meaning |
|--------|---------|
| 400 | Business rule that needs the database: payer/participant/settlement user is not a group member; `from_user_id == to_user_id` |
| 401 | Missing, invalid, or expired token; token for a non-existent user; wrong login credentials |
| 403 | Group exists, but the caller is not a member |
| 404 | Resource not found (e.g. group does not exist, unknown join code) |
| 409 | Conflict: email already registered; already a member of the group |
| 422 | Anything Pydantic can check on its own: missing/wrong-typed fields, amount ≤ 0 or malformed, unknown category, bad date, duplicate `participant_ids`, field-length violations |

### 1.6 Group access control
For every `/api/groups/{group_id}` and `/api/groups/{group_id}/...` endpoint, checks run in this order:
1. No/invalid token → `401`
2. Group does not exist → `404`
3. Group exists but caller is not a member → `403`

### 1.7 Categories (fixed enum)
```
rent | utilities | groceries | transport | dining | entertainment | other
```

### 1.8 IDs
All IDs (`user_id`, `group_id`, expense and settlement `id`) are **integers**.

### 1.9 Field constraints
| Field | Constraint |
|-------|------------|
| `email` | Valid email; **trimmed and lowercased** before storing/comparing |
| `password` | Min 8 characters |
| `display_name` | 1–30 characters |
| group `name` | 1–50 characters |
| `note` | Optional, max 200 characters; returned as `null` when absent |
| `join_code` | 8 characters, uppercase `A–Z` and `0–9` |

Violations → `422`.

### 1.10 List ordering
"Newest first" lists (expenses, settlements) are sorted by **`date` desc, then `created_at` desc, then `id` desc**.

### 1.11 Out of scope for v1
- Editing or deleting expenses or settlements
- Leaving a group or removing members
- Regenerating join codes
- Pagination (all lists return every matching item)

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
- `created_by` is the member who recorded the expense; it may differ from `payer_id`.
- `shares` lists only participants, sorted by `user_id`. The payer is not required to be a participant.

**Settlement**
```json
{
  "id": 7,
  "from_user_id": 2,
  "to_user_id": 1,
  "amount": "33.33",
  "date": "2026-11-16",
  "note": null,
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
  `replica` is the hostname of the backend container that served the request. It is intentionally exposed because it is the required demo evidence for load balancing.
- **Errors:** none expected.

---

### 4.2 Auth

#### `POST /api/auth/register`
- **Auth:** No
- **Request body:**
  ```json
  { "email": "Alice@Example.com ", "password": "s3cret-pass", "display_name": "Alice" }
  ```
  - `email`: trimmed and lowercased by the server.
  - `password`: min 8 characters.
  - `display_name`: 1–30 characters.
- **Response 201:** User
  ```json
  { "id": 1, "email": "alice@example.com", "display_name": "Alice" }
  ```
- **Errors:**
  - `409` – email already registered (compared after trim + lowercase)
  - `422` – missing fields, invalid email, password too short, display_name length out of range

#### `POST /api/auth/login`
- **Auth:** No
- **Request body (JSON, not form-encoded):**
  ```json
  { "email": "alice@example.com", "password": "s3cret-pass" }
  ```
  `email` is trimmed and lowercased before lookup.
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
  - `401` – missing/invalid/expired token, or the token's user no longer exists

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
Create a group. The caller automatically becomes its first member. The server generates a unique 8-character join code (`A–Z`, `0–9`).
- **Auth:** Yes
- **Request body:**
  ```json
  { "name": "Apartment 4B" }
  ```
  `name`: 1–50 characters.
- **Response 201:**
  ```json
  { "id": 10, "name": "Apartment 4B", "join_code": "K7Q2ZP4M", "created_at": "2026-11-17T18:30:00Z" }
  ```
- **Errors:**
  - `401` – missing/invalid token
  - `422` – missing name, or name length out of range

#### `POST /api/groups/join`
Join an existing group using its join code.
- **Auth:** Yes
- **Request body:**
  ```json
  { "join_code": "k7q2zp4m" }
  ```
  Input is **case-insensitive**; the server uppercases it before lookup.
- **Response 200:** Group (same shape as `GET /api/groups/{group_id}`)
  ```json
  {
    "id": 10,
    "name": "Apartment 4B",
    "join_code": "K7Q2ZP4M",
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
- **Response 200:** The join code is visible to all members.
  ```json
  {
    "id": 10,
    "name": "Apartment 4B",
    "join_code": "K7Q2ZP4M",
    "members": [
      { "user_id": 1, "display_name": "Alice" },
      { "user_id": 2, "display_name": "Bob" },
      { "user_id": 3, "display_name": "Carol" }
    ]
  }
  ```
  `members` is sorted by `user_id`.
- **Errors:**
  - `401` – missing/invalid token
  - `404` – group does not exist
  - `403` – group exists but caller is not a member

---

### 4.4 Expenses

#### `GET /api/groups/{group_id}/expenses`
List expenses in a group, newest first (`date` desc, `created_at` desc, `id` desc). No pagination.
- **Auth:** Yes (member)
- **Query parameters (all optional):**
  | Param | Format | Meaning |
  |-------|--------|---------|
  | `from` | `YYYY-MM-DD` | Only expenses with `date >= from` (inclusive) |
  | `to` | `YYYY-MM-DD` | Only expenses with `date <= to` (inclusive) |
  | `category` | category enum | Only expenses in this category |

  - `from > to` → `200` with an empty list `[]` (not an error).
  - Unknown `category` → `422`.

  Example: `GET /api/groups/10/expenses?from=2026-11-01&to=2026-11-30&category=groceries`
- **Response 200:** array of Expense
  ```json
  [
    {
      "id": 43,
      "amount": "60.00",
      "payer_id": 3,
      "category": "dining",
      "date": "2026-11-15",
      "note": null,
      "created_by": 1,
      "created_at": "2026-11-15T23:10:00Z",
      "shares": [
        { "user_id": 1, "amount": "30.00" },
        { "user_id": 2, "amount": "30.00" }
      ]
    },
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
  In expense 43, Alice (user 1) recorded a dinner that Carol (user 3) paid for but did not eat. Carol is the payer but not a participant.
- **Errors:**
  - `401` – missing/invalid token
  - `404` – group does not exist
  - `403` – caller is not a member
  - `422` – malformed date or unknown category

#### `POST /api/groups/{group_id}/expenses`
Record an expense, split evenly among participants (see §1.3).
- **Auth:** Yes (member)
- **Request body:**
  ```json
  {
    "amount": "100",
    "payer_id": 1,
    "participant_ids": [1, 2, 3],
    "category": "groceries",
    "date": "2026-11-15",
    "note": "Costco run"
  }
  ```
  `note` is optional (max 200 chars). `amount` is normalized, so `"100"` is stored and returned as `"100.00"`.
- **Rules:**
  - Any member may record an expense with **any member** as payer.
  - The payer does **not** have to be in `participant_ids`.
  - `participant_ids` must be non-empty and contain no duplicates.
  - `created_by` is set by the server to the caller.
- **Response 201:** Expense (see example in §3).
- **Errors:**
  - `400` – payer or a participant is not a member of this group
  - `401` – missing/invalid token
  - `404` – group does not exist
  - `403` – caller is not a member
  - `422` – missing fields or wrong types; amount ≤ 0, more than 2 decimals, or above `"99999999.99"`; empty or duplicate `participant_ids`; unknown category; bad date; note over 200 chars

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
  - **Every** member is included, even with `net = "0.00"`. Sorted by `user_id`.
  - Formula:
    ```
    net = (sum paid as payer)
        − (sum of own shares)
        + (settlements sent as from_user)
        − (settlements received as to_user)
    ```
- **Example:** using only expense 42 from §4.4 (Alice paid $100.00, split 3 ways), with no settlements yet:
  ```json
  [
    { "user_id": 1, "display_name": "Alice", "net": "66.66" },
    { "user_id": 2, "display_name": "Bob",   "net": "-33.33" },
    { "user_id": 3, "display_name": "Carol", "net": "-33.33" }
  ]
  ```
  Alice: 100.00 − 33.34 = 66.66. Bob and Carol: 0 − 33.33 = −33.33.
  If Bob then records a settlement of `"33.33"` to Alice: Bob → `"0.00"`, Alice → `"33.33"`, Carol unchanged.
- **Errors:**
  - `401` – missing/invalid token
  - `404` – group does not exist
  - `403` – caller is not a member

---

### 4.6 Settlements

#### `GET /api/groups/{group_id}/settlements`
List settlements (payments between members), newest first (`date` desc, `created_at` desc, `id` desc). No pagination.
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
  - `404` – group does not exist
  - `403` – caller is not a member

#### `POST /api/groups/{group_id}/settlements`
Record that one member paid another.
- **Auth:** Yes (member)
- **Request body:**
  ```json
  { "from_user_id": 2, "to_user_id": 1, "amount": "33.33", "date": "2026-11-16", "note": "e-transfer" }
  ```
  `note` is optional (max 200 chars).
- **Rules:**
  - Any member may record a settlement between **any two members** (not just themselves).
  - `from_user_id != to_user_id`.
  - **Overpaying is allowed.** The amount may exceed what `from_user` currently owes, and the balances may flip sign.
- **Response 201:** Settlement (see example in §3).
- **Errors:**
  - `400` – `from_user_id == to_user_id`; either user is not a member of this group
  - `401` – missing/invalid token
  - `404` – group does not exist
  - `403` – caller is not a member
  - `422` – missing fields or wrong types; amount ≤ 0, more than 2 decimals, or above `"99999999.99"`; bad date; note over 200 chars

---

## Proposed decisions (accepted unless backend owner objects)

1. Override FastAPI's validation handler so every error has a STRING "detail". (Frontend will still tolerate the list shape defensively.)
2. 422 = anything Pydantic can check on its own (missing/wrong type, amount <= 0, bad category, bad date). 400 = rules that need the database (payer/participant not a member, from == to).
3. Login is JSON {email, password}, not OAuth2 form.
4. Group does not exist -> 404. Group exists but caller is not a member -> 403.
5. Joining a group you are already in -> 409. Successful join -> 200.
6. Join code: 8 chars, uppercase A-Z and 0-9, unique, input is case-insensitive, not regenerable in v1, visible to all members.
7. Frontend always sends amount as a string. Accept "12", "12.3", "12.30" and normalize to 2 decimals; more than 2 decimals -> 422. Max "99999999.99".
8. Duplicate participant_ids -> 422. Payer does NOT have to be a participant.
9. Any member may record an expense with any member as payer, and a settlement between any two members.
10. Edit/delete expenses or settlements, leaving a group, removing members: out of scope for v1.
11. Sort: date desc, then created_at desc, then id desc.
12. from/to are inclusive. from > to -> empty list. Unknown category -> 422.
13. No pagination in v1.
14. Include members with net "0.00". Sort by user_id. Formula: net = (sum paid as payer) - (sum of own shares) + (settlements sent as from_user) - (settlements received as to_user).
15. Overpaying is allowed (balance may flip sign); no 400.
16. IDs are integers.
17. Group name 1-50 chars, display_name 1-30, note max 200, password min 8. Emails are trimmed and lowercased; duplicates -> 409.
18. Absent note is returned as null.
19. JWT: HS256, "sub" = user id as string, 60 min expiry. Token for a non-existent user -> 401.
20. Exposing the container hostname in /api/health is fine — it is required demo evidence for load balancing.
