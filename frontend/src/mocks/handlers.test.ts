import { describe, expect, it } from 'vitest'
import { getMe, login, register } from '../api/auth'
import { getBalances } from '../api/balances'
import { ApiError } from '../api/client'
import { createExpense, listExpenses } from '../api/expenses'
import { getGroup, joinGroup, listGroups } from '../api/groups'
import { createSettlement, listSettlements } from '../api/settlements'
import { clearToken } from '../api/token'
import { parseCents } from '../lib/money'
import { loginAs } from '../test/helpers'
import { SEED } from './db'

const APT = SEED.groups.apartment.id
const TRIP = SEED.groups.davesTrip.id
const { alice, bob, carol, dave } = SEED.users

/** Await a promise that should reject with an ApiError; return it. */
async function apiError(promise: Promise<unknown>): Promise<ApiError> {
  const err = await promise.then(
    () => {
      throw new Error('Expected the request to fail')
    },
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ApiError)
  return err as ApiError
}

function sumCents(values: string[]): number {
  return values.reduce((acc, v) => acc + parseCents(v), 0)
}

describe('auth', () => {
  it('logs in a seed user and returns a bearer token', async () => {
    const res = await login({ email: 'alice@test.com', password: 'password123' })
    expect(res).toEqual({ access_token: 'mock-token-1', token_type: 'bearer', expires_in: 3600 })
  })

  it('trims and lowercases the email', async () => {
    const res = await login({ email: '  Alice@Test.com ', password: 'password123' })
    expect(res.access_token).toBe('mock-token-1')
  })

  it('returns 401 for a wrong password', async () => {
    const err = await apiError(login({ email: 'alice@test.com', password: 'wrong-password' }))
    expect(err.status).toBe(401)
    expect(typeof err.detail).toBe('string')
  })

  it('GET /auth/me returns the user for a valid token and 401 without one', async () => {
    await loginAs('alice@test.com')
    expect(await getMe()).toEqual({ id: alice, email: 'alice@test.com', display_name: 'Alice' })

    clearToken()
    expect((await apiError(getMe())).status).toBe(401)
  })

  it('register returns 201 user, then 409 for the same email', async () => {
    const user = await register({ email: 'Erin@Test.com', password: 'longenough', display_name: 'Erin' })
    expect(user).toEqual({ id: 5, email: 'erin@test.com', display_name: 'Erin' })

    const err = await apiError(register({ email: 'erin@test.com', password: 'longenough', display_name: 'E' }))
    expect(err.status).toBe(409)
  })

  it('register rejects a short password with 422 and a string detail', async () => {
    const err = await apiError(register({ email: 'x@test.com', password: 'short', display_name: 'X' }))
    expect(err.status).toBe(422)
    expect(err.detail).toMatch(/password/)
  })
})

describe('cross-group access control', () => {
  it('dave gets 403 on every Apartment 4B endpoint', async () => {
    await loginAs('dave@test.com')
    const calls = [
      getGroup(APT),
      listExpenses(APT),
      getBalances(APT),
      listSettlements(APT),
      createExpense(APT, {
        amount: '10.00', payer_id: dave, participant_ids: [dave], category: 'other', date: '2026-11-17',
      }),
      createSettlement(APT, { from_user_id: dave, to_user_id: alice, amount: '1.00', date: '2026-11-17' }),
    ]
    for (const call of calls) {
      expect((await apiError(call)).status).toBe(403)
    }
  })

  it('alice gets 403 on Dave\'s Trip, and only sees her own groups', async () => {
    await loginAs('alice@test.com')
    expect((await apiError(getGroup(TRIP))).status).toBe(403)
    expect(await listGroups()).toEqual([{ id: APT, name: 'Apartment 4B', member_count: 3 }])
  })

  it('returns 404 for a group that does not exist', async () => {
    await loginAs('alice@test.com')
    expect((await apiError(getGroup(999))).status).toBe(404)
  })

  it('returns 401 (not 403/404) without a token', async () => {
    expect((await apiError(getGroup(APT))).status).toBe(401)
    expect((await apiError(getGroup(999))).status).toBe(401)
  })

  it('rejects payers and participants from outside the group with 400', async () => {
    await loginAs('alice@test.com')
    const base = { amount: '10.00', category: 'other' as const, date: '2026-11-17' }
    expect((await apiError(createExpense(APT, { ...base, payer_id: dave, participant_ids: [alice] }))).status).toBe(400)
    expect((await apiError(createExpense(APT, { ...base, payer_id: alice, participant_ids: [alice, dave] }))).status).toBe(400)
  })
})

describe('join codes', () => {
  it('joins case-insensitively, then 409 on a second join, 404 for an unknown code', async () => {
    await loginAs('dave@test.com')
    const group = await joinGroup('k7q2zp4m')
    expect(group.id).toBe(APT)
    expect(group.members.map((m) => m.user_id)).toEqual([alice, bob, carol, dave])

    expect((await apiError(joinGroup('K7Q2ZP4M'))).status).toBe(409)
    expect((await apiError(joinGroup('NOPE0000'))).status).toBe(404)
  })
})

describe('expenses', () => {
  it('lists seed expenses newest first (date desc, then created_at desc)', async () => {
    await loginAs('alice@test.com')
    const expenses = await listExpenses(APT)
    expect(expenses.map((e) => [e.date, e.category])).toEqual([
      ['2026-11-15', 'dining'],
      ['2026-11-15', 'groceries'],
      ['2026-11-10', 'utilities'],
      ['2026-11-01', 'rent'],
    ])
    expect(expenses[0].note).toBeNull()
  })

  it('filters by inclusive date range and category; from > to is an empty list', async () => {
    await loginAs('alice@test.com')
    expect((await listExpenses(APT, { from: '2026-11-10', to: '2026-11-15' })).length).toBe(3)
    expect((await listExpenses(APT, { from: '2026-11-15', to: '2026-11-15' })).length).toBe(2)
    expect((await listExpenses(APT, { category: 'rent' })).map((e) => e.amount)).toEqual(['1500.00'])
    expect(await listExpenses(APT, { from: '2026-11-30', to: '2026-11-01' })).toEqual([])
  })

  it('returns 422 for an unknown category', async () => {
    await loginAs('alice@test.com')
    // Cast: the type system already prevents this, the backend must too.
    const err = await apiError(listExpenses(APT, { category: 'pets' as never }))
    expect(err.status).toBe(422)
  })

  it('creates an expense split in integer cents with leftovers to ascending user_id', async () => {
    await loginAs('alice@test.com')
    const expense = await createExpense(APT, {
      amount: '100', payer_id: bob, participant_ids: [carol, alice, bob], category: 'groceries', date: '2026-11-17',
    })
    expect(expense.amount).toBe('100.00')
    expect(expense.created_by).toBe(alice)
    expect(expense.note).toBeNull()
    expect(expense.shares).toEqual([
      { user_id: alice, amount: '33.34' },
      { user_id: bob, amount: '33.33' },
      { user_id: carol, amount: '33.33' },
    ])
  })

  it.each([
    ['amount <= 0', { amount: '0' }],
    ['more than 2 decimals', { amount: '1.234' }],
    ['amount above max', { amount: '100000000.00' }],
    ['duplicate participants', { participant_ids: [1, 1] }],
    ['empty participants', { participant_ids: [] }],
    ['bad date', { date: '2026-02-30' }],
  ])('returns 422 for %s', async (_label, override) => {
    await loginAs('alice@test.com')
    const body = {
      amount: '10.00', payer_id: alice, participant_ids: [alice], category: 'other' as const, date: '2026-11-17',
      ...override,
    }
    expect((await apiError(createExpense(APT, body))).status).toBe(422)
  })
})

describe('balances and settlements', () => {
  it('balances sum to 0.00 and match the §4.5 formula for the seed', async () => {
    await loginAs('alice@test.com')
    const balances = await getBalances(APT)
    expect(balances).toEqual([
      { user_id: alice, display_name: 'Alice', net: '973.16' },
      { user_id: bob, display_name: 'Bob', net: '-469.67' },
      { user_id: carol, display_name: 'Carol', net: '-503.49' },
    ])
    expect(sumCents(balances.map((b) => b.net))).toBe(0)
  })

  it('balances still sum to 0.00 after new expenses and an overpaying settlement', async () => {
    await loginAs('carol@test.com')
    await createExpense(APT, {
      amount: '10.01', payer_id: carol, participant_ids: [alice, bob, carol], category: 'other', date: '2026-11-17',
    })
    // Overpaying is allowed (decision 15): Carol pays Alice far more than she owes.
    const s = await createSettlement(APT, {
      from_user_id: carol, to_user_id: alice, amount: '2000', date: '2026-11-17',
    })
    expect(s.amount).toBe('2000.00')
    expect(s.note).toBeNull()

    const balances = await getBalances(APT)
    expect(sumCents(balances.map((b) => b.net))).toBe(0)
    expect(parseCents(balances.find((b) => b.user_id === carol)!.net)).toBeGreaterThan(0)
  })

  it('includes members with a zero balance', async () => {
    await loginAs('dave@test.com')
    await joinGroup(SEED.groups.apartment.join_code)
    const dave_ = (await getBalances(APT)).find((b) => b.user_id === dave)
    expect(dave_?.net).toBe('0.00')
  })

  it('rejects from == to with 400 and lists settlements newest first', async () => {
    await loginAs('alice@test.com')
    const err = await apiError(createSettlement(APT, {
      from_user_id: alice, to_user_id: alice, amount: '5.00', date: '2026-11-17',
    }))
    expect(err.status).toBe(400)

    await createSettlement(APT, { from_user_id: carol, to_user_id: alice, amount: '5', date: '2026-11-17' })
    const list = await listSettlements(APT)
    expect(list.map((x) => x.date)).toEqual(['2026-11-17', '2026-11-16'])
  })
})
