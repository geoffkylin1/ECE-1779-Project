import { describe, expect, it } from 'vitest'
import { memberName, settleUpDraft } from './balances'
import { displayDate, todayLocal } from './date'
import { normalizeNote, validateAmount, validateNote } from './validation'

const b = (user_id: number, net: string) => ({ user_id, display_name: `U${user_id}`, net })

describe('settleUpDraft', () => {
  it('pays the largest creditor the smaller absolute amount', () => {
    const balances = [b(1, '10.00'), b(2, '-30.00'), b(3, '20.00')]
    expect(settleUpDraft(balances, 2)).toEqual({ fromUserId: 2, toUserId: 3, amount: '20.00' })
  })
  it('breaks ties toward the lowest user_id', () => {
    expect(settleUpDraft([b(1, '5.00'), b(2, '5.00'), b(3, '-10.00')], 3)?.toUserId).toBe(1)
  })
  it('returns null for creditors, settled members and unknown users', () => {
    const balances = [b(1, '5.00'), b(2, '-5.00'), b(3, '0.00')]
    expect(settleUpDraft(balances, 1)).toBeNull()
    expect(settleUpDraft(balances, 3)).toBeNull()
    expect(settleUpDraft(balances, 9)).toBeNull()
  })
})

describe('memberName', () => {
  it('never falls back to a raw id', () => {
    expect(memberName([{ user_id: 1, display_name: 'Alice' }], 1)).toBe('Alice')
    expect(memberName([], 7)).toBe('Unknown member')
  })
})

describe('dates', () => {
  it('todayLocal uses local calendar fields, not UTC', () => {
    // 23:30 local on Nov 17 is Nov 18 in UTC for zones west of UTC; we want the local day.
    expect(todayLocal(new Date(2026, 10, 17, 23, 30))).toBe('2026-11-17')
    expect(todayLocal(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05')
  })
  it('displayDate does not shift the day', () => {
    expect(displayDate('2026-11-01')).toBe('Nov 1, 2026')
  })
})

describe('validateAmount', () => {
  it.each([
    ['', 'Amount is required'],
    ['abc', 'Enter an amount like 12.34'],
    ['-5', 'Enter an amount like 12.34'],
    ['0', 'Amount must be greater than 0'],
    ['0.00', 'Amount must be greater than 0'],
    ['1.234', 'Use at most 2 decimal places'],
    ['100000000', 'Amount must be at most 99,999,999.99'],
  ])('%j -> %s', (input, message) => {
    expect(validateAmount(input)).toBe(message)
  })
  it.each(['0.01', '12', '12.3', ' 12.30 ', '99999999.99'])('accepts %j', (input) => {
    expect(validateAmount(input)).toBeUndefined()
  })
})

describe('notes', () => {
  it('max 200 characters; blank becomes null', () => {
    expect(validateNote('x'.repeat(200))).toBeUndefined()
    expect(validateNote('x'.repeat(201))).toBe('Note must be at most 200 characters')
    expect(normalizeNote('   ')).toBeNull()
    expect(normalizeNote('  hi ')).toBe('hi')
  })
})
