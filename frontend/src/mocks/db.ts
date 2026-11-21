/**
 * In-memory database for the mock API. Mirrors what the real backend stores:
 * money is kept in integer cents, everything else as the contract describes.
 *
 * Call resetDb() to restore the seed (tests do this before each test).
 * In the browser the data lives only until the page is reloaded.
 */

import type { Category } from '../api/types'
import { parseCents, splitCents } from '../lib/money'

export interface DbUser {
  id: number
  email: string
  password: string
  display_name: string
}

export interface DbGroup {
  id: number
  name: string
  join_code: string
  created_at: string
}

export interface DbMembership {
  group_id: number
  user_id: number
}

export interface DbShare {
  user_id: number
  cents: number
}

export interface DbExpense {
  id: number
  group_id: number
  amount_cents: number
  payer_id: number
  category: Category
  date: string
  note: string | null
  created_by: number
  created_at: string
  shares: DbShare[]
}

export interface DbSettlement {
  id: number
  group_id: number
  from_user_id: number
  to_user_id: number
  amount_cents: number
  date: string
  note: string | null
  created_at: string
}

interface Database {
  users: DbUser[]
  groups: DbGroup[]
  memberships: DbMembership[]
  expenses: DbExpense[]
  settlements: DbSettlement[]
  nextId: { user: number; group: number; expense: number; settlement: number }
}

export const db: Database = emptyDatabase()

function emptyDatabase(): Database {
  return {
    users: [],
    groups: [],
    memberships: [],
    expenses: [],
    settlements: [],
    nextId: { user: 1, group: 1, expense: 1, settlement: 1 },
  }
}

/** ISO 8601 UTC without milliseconds, e.g. "2026-11-17T18:30:00Z". */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// ---------- Token ----------

export const MOCK_TOKEN_PREFIX = 'mock-token-'

export function tokenFor(userId: number): string {
  return `${MOCK_TOKEN_PREFIX}${userId}`
}

// ---------- Queries ----------

export function findUserById(id: number): DbUser | undefined {
  return db.users.find((u) => u.id === id)
}

export function findUserByEmail(email: string): DbUser | undefined {
  return db.users.find((u) => u.email === email)
}

export function findGroupById(id: number): DbGroup | undefined {
  return db.groups.find((g) => g.id === id)
}

export function findGroupByJoinCode(code: string): DbGroup | undefined {
  return db.groups.find((g) => g.join_code === code)
}

export function isMember(groupId: number, userId: number): boolean {
  return db.memberships.some((m) => m.group_id === groupId && m.user_id === userId)
}

/** Members of a group, sorted by user_id. */
export function groupMembers(groupId: number): DbUser[] {
  return db.memberships
    .filter((m) => m.group_id === groupId)
    .map((m) => findUserById(m.user_id))
    .filter((u): u is DbUser => u !== undefined)
    .sort((a, b) => a.id - b.id)
}

// ---------- Mutations ----------

export function insertUser(input: Omit<DbUser, 'id'>): DbUser {
  const user: DbUser = { id: db.nextId.user++, ...input }
  db.users.push(user)
  return user
}

const JOIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateJoinCode(): string {
  for (;;) {
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)]
    }
    if (!findGroupByJoinCode(code)) {
      return code
    }
  }
}

export function insertGroup(input: {
  name: string
  creatorId: number
  join_code?: string
  created_at?: string
}): DbGroup {
  const group: DbGroup = {
    id: db.nextId.group++,
    name: input.name,
    join_code: input.join_code ?? generateJoinCode(),
    created_at: input.created_at ?? nowIso(),
  }
  db.groups.push(group)
  addMember(group.id, input.creatorId)
  return group
}

export function addMember(groupId: number, userId: number): void {
  if (!isMember(groupId, userId)) {
    db.memberships.push({ group_id: groupId, user_id: userId })
  }
}

/** Equal split in integer cents; leftover cents to ascending user_id (contract §1.3). */
export function insertExpense(input: {
  group_id: number
  amount_cents: number
  payer_id: number
  participant_ids: number[]
  category: Category
  date: string
  note: string | null
  created_by: number
  created_at?: string
}): DbExpense {
  const expense: DbExpense = {
    id: db.nextId.expense++,
    group_id: input.group_id,
    amount_cents: input.amount_cents,
    payer_id: input.payer_id,
    category: input.category,
    date: input.date,
    note: input.note,
    created_by: input.created_by,
    created_at: input.created_at ?? nowIso(),
    shares: splitCents(input.amount_cents, input.participant_ids),
  }
  db.expenses.push(expense)
  return expense
}

export function insertSettlement(input: Omit<DbSettlement, 'id' | 'created_at'> & {
  created_at?: string
}): DbSettlement {
  const settlement: DbSettlement = {
    id: db.nextId.settlement++,
    ...input,
    created_at: input.created_at ?? nowIso(),
  }
  db.settlements.push(settlement)
  return settlement
}

// ---------- Seed ----------

export const SEED_PASSWORD = 'password123'

/** IDs and codes of the seed data, for tests. */
export const SEED = {
  users: { alice: 1, bob: 2, carol: 3, dave: 4 },
  groups: {
    apartment: { id: 1, name: 'Apartment 4B', join_code: 'K7Q2ZP4M' },
    davesTrip: { id: 2, name: "Dave's Trip", join_code: 'DAVETRIP' },
  },
} as const

function seed(): void {
  const alice = insertUser({ email: 'alice@test.com', password: SEED_PASSWORD, display_name: 'Alice' })
  const bob = insertUser({ email: 'bob@test.com', password: SEED_PASSWORD, display_name: 'Bob' })
  const carol = insertUser({ email: 'carol@test.com', password: SEED_PASSWORD, display_name: 'Carol' })
  const dave = insertUser({ email: 'dave@test.com', password: SEED_PASSWORD, display_name: 'Dave' })

  // Group 1: Alice, Bob, Carol. Dave is NOT a member (cross-group access tests).
  const apartment = insertGroup({
    name: SEED.groups.apartment.name,
    creatorId: alice.id,
    join_code: SEED.groups.apartment.join_code,
    created_at: '2026-10-30T12:00:00Z',
  })
  addMember(apartment.id, bob.id)
  addMember(apartment.id, carol.id)

  const all = [alice.id, bob.id, carol.id]
  // 1500.00 / 3 = 500.00 each
  insertExpense({
    group_id: apartment.id, amount_cents: parseCents('1500.00'), payer_id: alice.id,
    participant_ids: all, category: 'rent', date: '2026-11-01', note: 'November rent',
    created_by: alice.id, created_at: '2026-11-01T15:00:00Z',
  })
  // 90.50 / 3 = 30.17, 30.17, 30.16 (2 leftover cents -> users 1 and 2)
  insertExpense({
    group_id: apartment.id, amount_cents: parseCents('90.50'), payer_id: bob.id,
    participant_ids: all, category: 'utilities', date: '2026-11-10', note: 'Hydro',
    created_by: bob.id, created_at: '2026-11-10T20:00:00Z',
  })
  // 100.00 / 3 = 33.34, 33.33, 33.33 (contract §1.3 example)
  insertExpense({
    group_id: apartment.id, amount_cents: parseCents('100.00'), payer_id: alice.id,
    participant_ids: all, category: 'groceries', date: '2026-11-15', note: 'Costco run',
    created_by: alice.id, created_at: '2026-11-15T21:04:11Z',
  })
  // Carol paid but did not eat; recorded by Alice (contract §4.4 example)
  insertExpense({
    group_id: apartment.id, amount_cents: parseCents('60.00'), payer_id: carol.id,
    participant_ids: [alice.id, bob.id], category: 'dining', date: '2026-11-15', note: null,
    created_by: alice.id, created_at: '2026-11-15T23:10:00Z',
  })
  insertSettlement({
    group_id: apartment.id, from_user_id: bob.id, to_user_id: alice.id,
    amount_cents: parseCents('33.33'), date: '2026-11-16', note: 'e-transfer',
    created_at: '2026-11-16T14:20:00Z',
  })

  // Group 2: Dave only.
  const trip = insertGroup({
    name: SEED.groups.davesTrip.name,
    creatorId: dave.id,
    join_code: SEED.groups.davesTrip.join_code,
    created_at: '2026-11-02T09:00:00Z',
  })
  insertExpense({
    group_id: trip.id, amount_cents: parseCents('45.00'), payer_id: dave.id,
    participant_ids: [dave.id], category: 'transport', date: '2026-11-03', note: 'Train tickets',
    created_by: dave.id, created_at: '2026-11-03T08:00:00Z',
  })
}

/** Restore the database to the seed state. */
export function resetDb(): void {
  Object.assign(db, emptyDatabase())
  seed()
}

resetDb()
