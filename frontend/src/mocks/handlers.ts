/**
 * MSW handlers implementing the whole API contract (docs/api-contract.md)
 * against the in-memory database in ./db.ts.
 *
 * Status-code order for group endpoints (contract §1.6):
 *   401 no/invalid token -> 404 group missing -> 403 not a member
 *   -> 422 validation (Pydantic-checkable) -> 400 rules needing the DB
 */

import { http, HttpResponse } from 'msw'
import type {
  Balance,
  CreatedGroup,
  Expense,
  GroupDetail,
  GroupSummary,
  LoginResponse,
  Settlement,
  User,
} from '../api/types'
import { formatCents, normalizeMoney, parseCents } from '../lib/money'
import {
  addMember,
  db,
  findGroupById,
  findGroupByJoinCode,
  findUserByEmail,
  findUserById,
  groupMembers,
  insertExpense,
  insertGroup,
  insertSettlement,
  insertUser,
  isMember,
  MOCK_TOKEN_PREFIX,
  tokenFor,
  type DbExpense,
  type DbGroup,
  type DbSettlement,
  type DbUser,
} from './db'
import {
  type Body,
  checkAmount,
  checkCategory,
  checkDate,
  checkEmail,
  checkNote,
  checkParticipants,
  checkPassword,
  checkRequired,
  checkText,
  checkUserId,
  firstError,
  isCategory,
  isValidDate,
  normalizeNote,
} from './validation'

/** Matches /api on any origin (browser dev server and Node tests). */
const API = '*/api'

// ---------- Helpers ----------

function error(status: number, detail: string) {
  return HttpResponse.json({ detail }, { status })
}

function authenticate(request: Request): DbUser | null {
  const header = request.headers.get('Authorization') ?? ''
  const match = /^Bearer (\S+)$/.exec(header)
  if (!match || !match[1].startsWith(MOCK_TOKEN_PREFIX)) {
    return null
  }
  const id = Number(match[1].slice(MOCK_TOKEN_PREFIX.length))
  // A well-formed token for a user that does not exist is also 401 (decision 19).
  return Number.isInteger(id) ? (findUserById(id) ?? null) : null
}

const UNAUTHORIZED = 'Could not validate credentials'

async function readBody(request: Request): Promise<Body | null> {
  try {
    const data: unknown = await request.json()
    return data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Body) : null
  } catch {
    return null
  }
}

/** Runs the §1.6 checks: 401 -> 404 -> 403. Returns the caller and group, or an error response. */
function authorizeGroup(
  request: Request,
  rawGroupId: unknown,
): { user: DbUser; group: DbGroup } | Response {
  const user = authenticate(request)
  if (!user) {
    return error(401, UNAUTHORIZED)
  }
  const groupId = Number(rawGroupId)
  if (!Number.isInteger(groupId)) {
    return error(422, 'group_id must be an integer')
  }
  const group = findGroupById(groupId)
  if (!group) {
    return error(404, 'Group not found')
  }
  if (!isMember(group.id, user.id)) {
    return error(403, 'You are not a member of this group')
  }
  return { user, group }
}

// ---------- Serializers ----------

function toUser(u: DbUser): User {
  return { id: u.id, email: u.email, display_name: u.display_name }
}

function toGroupDetail(g: DbGroup): GroupDetail {
  return {
    id: g.id,
    name: g.name,
    join_code: g.join_code,
    members: groupMembers(g.id).map((u) => ({ user_id: u.id, display_name: u.display_name })),
  }
}

function toExpense(e: DbExpense): Expense {
  return {
    id: e.id,
    amount: formatCents(e.amount_cents),
    payer_id: e.payer_id,
    category: e.category,
    date: e.date,
    note: e.note,
    created_by: e.created_by,
    created_at: e.created_at,
    shares: e.shares.map((s) => ({ user_id: s.user_id, amount: formatCents(s.cents) })),
  }
}

function toSettlement(s: DbSettlement): Settlement {
  return {
    id: s.id,
    from_user_id: s.from_user_id,
    to_user_id: s.to_user_id,
    amount: formatCents(s.amount_cents),
    date: s.date,
    note: s.note,
    created_at: s.created_at,
  }
}

/** Newest first: date desc, then created_at desc, then id desc (decision 11). */
function newestFirst<T extends { date: string; created_at: string; id: number }>(a: T, b: T): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
  return b.id - a.id
}

/** net = paid as payer - own shares + settlements sent - settlements received (§4.5). */
export function computeBalances(groupId: number): Balance[] {
  const members = groupMembers(groupId)
  const net = new Map<number, number>(members.map((u) => [u.id, 0]))
  const add = (userId: number, cents: number) => net.set(userId, (net.get(userId) ?? 0) + cents)

  for (const e of db.expenses.filter((x) => x.group_id === groupId)) {
    add(e.payer_id, e.amount_cents)
    for (const share of e.shares) add(share.user_id, -share.cents)
  }
  for (const s of db.settlements.filter((x) => x.group_id === groupId)) {
    add(s.from_user_id, s.amount_cents)
    add(s.to_user_id, -s.amount_cents)
  }

  return members.map((u) => ({
    user_id: u.id,
    display_name: u.display_name,
    net: formatCents(net.get(u.id) ?? 0),
  }))
}

// ---------- Handlers ----------

export const handlers = [
  // §4.1
  http.get(`${API}/health`, () => HttpResponse.json({ status: 'ok', replica: 'mock' })),

  // §4.2 register
  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = await readBody(request)
    if (!body) return error(422, 'Request body must be a JSON object')
    const invalid = firstError(
      checkRequired(body, ['email', 'password', 'display_name']),
      checkEmail(body.email),
      checkPassword(body.password),
      checkText(body.display_name, 'display_name', 1, 30),
    )
    if (invalid) return error(422, invalid)

    const email = String(body.email).trim().toLowerCase()
    if (findUserByEmail(email)) return error(409, 'Email already registered')

    const user = insertUser({
      email,
      password: String(body.password),
      display_name: String(body.display_name).trim(),
    })
    return HttpResponse.json<User>(toUser(user), { status: 201 })
  }),

  // §4.2 login (JSON, not form-encoded)
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = await readBody(request)
    if (!body) return error(422, 'Request body must be a JSON object')
    const invalid = checkRequired(body, ['email', 'password'])
    if (invalid) return error(422, invalid)

    const user = findUserByEmail(String(body.email).trim().toLowerCase())
    if (!user || user.password !== body.password) {
      return error(401, 'Incorrect email or password')
    }
    return HttpResponse.json<LoginResponse>({
      access_token: tokenFor(user.id),
      token_type: 'bearer',
      expires_in: 3600,
    })
  }),

  // §4.2 me
  http.get(`${API}/auth/me`, ({ request }) => {
    const user = authenticate(request)
    if (!user) return error(401, UNAUTHORIZED)
    return HttpResponse.json<User>(toUser(user))
  }),

  // §4.3 list my groups
  http.get(`${API}/groups`, ({ request }) => {
    const user = authenticate(request)
    if (!user) return error(401, UNAUTHORIZED)
    const groups: GroupSummary[] = db.groups
      .filter((g) => isMember(g.id, user.id))
      .sort((a, b) => a.id - b.id)
      .map((g) => ({ id: g.id, name: g.name, member_count: groupMembers(g.id).length }))
    return HttpResponse.json(groups)
  }),

  // §4.3 create group
  http.post(`${API}/groups`, async ({ request }) => {
    const user = authenticate(request)
    if (!user) return error(401, UNAUTHORIZED)
    const body = await readBody(request)
    if (!body) return error(422, 'Request body must be a JSON object')
    const invalid = firstError(checkRequired(body, ['name']), checkText(body.name, 'name', 1, 50))
    if (invalid) return error(422, invalid)

    const group = insertGroup({ name: String(body.name).trim(), creatorId: user.id })
    return HttpResponse.json<CreatedGroup>(
      { id: group.id, name: group.name, join_code: group.join_code, created_at: group.created_at },
      { status: 201 },
    )
  }),

  // §4.3 join (case-insensitive code). Registered before /groups/:groupId for clarity.
  http.post(`${API}/groups/join`, async ({ request }) => {
    const user = authenticate(request)
    if (!user) return error(401, UNAUTHORIZED)
    const body = await readBody(request)
    if (!body) return error(422, 'Request body must be a JSON object')
    if (typeof body.join_code !== 'string' || body.join_code.trim() === '') {
      return error(422, 'join_code is required')
    }

    const group = findGroupByJoinCode(body.join_code.trim().toUpperCase())
    if (!group) return error(404, 'No group with this join code')
    if (isMember(group.id, user.id)) return error(409, 'You are already a member of this group')

    addMember(group.id, user.id)
    return HttpResponse.json<GroupDetail>(toGroupDetail(group))
  }),

  // §4.3 group detail
  http.get(`${API}/groups/:groupId`, ({ request, params }) => {
    const auth = authorizeGroup(request, params.groupId)
    if (auth instanceof Response) return auth
    return HttpResponse.json<GroupDetail>(toGroupDetail(auth.group))
  }),

  // §4.4 list expenses
  http.get(`${API}/groups/:groupId/expenses`, ({ request, params }) => {
    const auth = authorizeGroup(request, params.groupId)
    if (auth instanceof Response) return auth

    const query = new URL(request.url).searchParams
    const from = query.get('from')
    const to = query.get('to')
    const category = query.get('category')
    if (from !== null && !isValidDate(from)) return error(422, 'from must be a valid date in YYYY-MM-DD format')
    if (to !== null && !isValidDate(to)) return error(422, 'to must be a valid date in YYYY-MM-DD format')
    if (category !== null && !isCategory(category)) return error(422, checkCategory(category) ?? '')

    // from/to inclusive; from > to simply matches nothing (decision 12).
    const expenses = db.expenses
      .filter((e) => e.group_id === auth.group.id)
      .filter((e) => (from === null || e.date >= from) && (to === null || e.date <= to))
      .filter((e) => category === null || e.category === category)
      .sort(newestFirst)
      .map(toExpense)
    return HttpResponse.json(expenses)
  }),

  // §4.4 create expense
  http.post(`${API}/groups/:groupId/expenses`, async ({ request, params }) => {
    const auth = authorizeGroup(request, params.groupId)
    if (auth instanceof Response) return auth

    const body = await readBody(request)
    if (!body) return error(422, 'Request body must be a JSON object')
    const invalid = firstError(
      checkRequired(body, ['amount', 'payer_id', 'participant_ids', 'category', 'date']),
      checkAmount(body.amount),
      checkUserId(body.payer_id, 'payer_id'),
      checkParticipants(body.participant_ids),
      checkCategory(body.category),
      checkDate(body.date),
      checkNote(body.note),
    )
    if (invalid) return error(422, invalid)

    const payerId = body.payer_id as number
    const participantIds = body.participant_ids as number[]
    if (!isMember(auth.group.id, payerId)) {
      return error(400, 'Payer is not a member of this group')
    }
    if (participantIds.some((id) => !isMember(auth.group.id, id))) {
      return error(400, 'All participants must be members of this group')
    }

    const expense = insertExpense({
      group_id: auth.group.id,
      amount_cents: parseCents(normalizeMoney(body.amount as string)),
      payer_id: payerId,
      participant_ids: participantIds,
      category: body.category as Expense['category'],
      date: body.date as string,
      note: normalizeNote(body.note),
      created_by: auth.user.id,
    })
    return HttpResponse.json<Expense>(toExpense(expense), { status: 201 })
  }),

  // §4.5 balances
  http.get(`${API}/groups/:groupId/balances`, ({ request, params }) => {
    const auth = authorizeGroup(request, params.groupId)
    if (auth instanceof Response) return auth
    return HttpResponse.json<Balance[]>(computeBalances(auth.group.id))
  }),

  // §4.6 list settlements
  http.get(`${API}/groups/:groupId/settlements`, ({ request, params }) => {
    const auth = authorizeGroup(request, params.groupId)
    if (auth instanceof Response) return auth
    const settlements = db.settlements
      .filter((s) => s.group_id === auth.group.id)
      .sort(newestFirst)
      .map(toSettlement)
    return HttpResponse.json(settlements)
  }),

  // §4.6 create settlement (overpaying allowed — decision 15)
  http.post(`${API}/groups/:groupId/settlements`, async ({ request, params }) => {
    const auth = authorizeGroup(request, params.groupId)
    if (auth instanceof Response) return auth

    const body = await readBody(request)
    if (!body) return error(422, 'Request body must be a JSON object')
    const invalid = firstError(
      checkRequired(body, ['from_user_id', 'to_user_id', 'amount', 'date']),
      checkUserId(body.from_user_id, 'from_user_id'),
      checkUserId(body.to_user_id, 'to_user_id'),
      checkAmount(body.amount),
      checkDate(body.date),
      checkNote(body.note),
    )
    if (invalid) return error(422, invalid)

    const fromId = body.from_user_id as number
    const toId = body.to_user_id as number
    if (fromId === toId) {
      return error(400, 'from_user_id and to_user_id must be different')
    }
    if (!isMember(auth.group.id, fromId) || !isMember(auth.group.id, toId)) {
      return error(400, 'Both users must be members of this group')
    }

    const settlement = insertSettlement({
      group_id: auth.group.id,
      from_user_id: fromId,
      to_user_id: toId,
      amount_cents: parseCents(body.amount as string),
      date: body.date as string,
      note: normalizeNote(body.note),
    })
    return HttpResponse.json<Settlement>(toSettlement(settlement), { status: 201 })
  }),
]
