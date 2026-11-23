/**
 * Types for every request/response in docs/api-contract.md.
 * Money is always a decimal `string` (e.g. "12.34"); IDs are always `number`.
 * Dates are "YYYY-MM-DD" strings; timestamps are ISO 8601 UTC strings.
 */

/** Decimal money string with 2 places, e.g. "12.34" (contract §1.3). */
export type Money = string
/** "YYYY-MM-DD" (contract §1.4). */
export type DateString = string
/** ISO 8601 UTC timestamp, e.g. "2026-11-17T18:30:00Z" (contract §1.4). */
export type Timestamp = string

/** Fixed category enum (contract §1.7). */
export const CATEGORIES = [
  'rent',
  'utilities',
  'groceries',
  'transport',
  'dining',
  'entertainment',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

// ---------- Errors (§1.5) ----------

/** FastAPI's default 422 item shape; the backend should not send it, but we tolerate it. */
export interface ValidationErrorItem {
  loc?: Array<string | number>
  msg: string
  type?: string
}

export interface ErrorResponse {
  detail: string | ValidationErrorItem[]
}

// ---------- Health (§4.1) ----------

export interface HealthResponse {
  status: 'ok'
  replica: string
}

// ---------- Auth (§4.2) ----------

export interface User {
  id: number
  email: string
  display_name: string
}

export interface RegisterRequest {
  email: string
  password: string
  display_name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: 'bearer'
  /** Seconds until the token expires (3600). */
  expires_in: number
}

// ---------- Groups (§4.3) ----------

export interface GroupSummary {
  id: number
  name: string
  member_count: number
}

export interface CreateGroupRequest {
  name: string
}

export interface CreatedGroup {
  id: number
  name: string
  join_code: string
  created_at: Timestamp
}

export interface JoinGroupRequest {
  join_code: string
}

export interface GroupMember {
  user_id: number
  display_name: string
}

export interface GroupDetail {
  id: number
  name: string
  join_code: string
  /** Sorted by user_id. */
  members: GroupMember[]
}

// ---------- Expenses (§4.4) ----------

export interface ExpenseShare {
  user_id: number
  amount: Money
}

export interface Expense {
  id: number
  amount: Money
  payer_id: number
  category: Category
  date: DateString
  note: string | null
  created_by: number
  created_at: Timestamp
  shares: ExpenseShare[]
}

export interface ExpenseFilters {
  /** Inclusive lower bound. */
  from?: DateString
  /** Inclusive upper bound. */
  to?: DateString
  category?: Category
}

export interface CreateExpenseRequest {
  amount: Money
  payer_id: number
  participant_ids: number[]
  category: Category
  date: DateString
  note?: string | null
}

// ---------- Balances (§4.5) ----------

export interface Balance {
  user_id: number
  display_name: string
  /** > 0: should receive money. < 0: owes money. All nets sum to "0.00". */
  net: Money
}

// ---------- Settlements (§4.6) ----------

export interface Settlement {
  id: number
  from_user_id: number
  to_user_id: number
  amount: Money
  date: DateString
  note: string | null
  created_at: Timestamp
}

export interface CreateSettlementRequest {
  from_user_id: number
  to_user_id: number
  amount: Money
  date: DateString
  note?: string | null
}
