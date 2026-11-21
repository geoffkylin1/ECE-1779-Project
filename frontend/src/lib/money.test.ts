import { describe, expect, it } from 'vitest'
import {
  displayMoney,
  formatCents,
  isValidMoney,
  normalizeMoney,
  parseCents,
  splitCents,
} from './money'

describe('parseCents', () => {
  it.each([
    ['12.34', 1234],
    ['12.3', 1230],
    ['12', 1200],
    ['0.01', 1],
    ['0.00', 0],
    ['-5.01', -501],
    ['99999999.99', 9_999_999_999],
  ])('parses %s -> %i cents', (input, cents) => {
    expect(parseCents(input)).toBe(cents)
  })

  it('avoids float rounding errors (0.1 + 0.2 style)', () => {
    expect(parseCents('0.10') + parseCents('0.20')).toBe(30)
    expect(parseCents('19.99')).toBe(1999) // 19.99 * 100 = 1998.9999999999998 as a float
  })

  it.each(['12.345', 'abc', '', '1,000.00', '.50', '12.'])('rejects %j', (input) => {
    expect(() => parseCents(input)).toThrow()
  })
})

describe('formatCents', () => {
  it.each([
    [1234, '12.34'],
    [1230, '12.30'],
    [5, '0.05'],
    [0, '0.00'],
    [-501, '-5.01'],
    [150000, '1500.00'],
  ])('formats %i -> %s', (cents, output) => {
    expect(formatCents(cents)).toBe(output)
  })

  it('rejects non-integers', () => {
    expect(() => formatCents(12.5)).toThrow()
  })

  it('round-trips with parseCents', () => {
    for (const value of ['0.00', '0.01', '12.34', '-33.33', '99999999.99']) {
      expect(formatCents(parseCents(value))).toBe(value)
    }
  })
})

describe('normalizeMoney / isValidMoney', () => {
  it('normalizes accepted inputs to 2 decimals', () => {
    expect(normalizeMoney('12')).toBe('12.00')
    expect(normalizeMoney('12.3')).toBe('12.30')
    expect(normalizeMoney('12.30')).toBe('12.30')
  })

  it('validates', () => {
    expect(isValidMoney('12.30')).toBe(true)
    expect(isValidMoney('12.345')).toBe(false)
  })
})

describe('displayMoney', () => {
  it('adds a dollar sign and thousands separators', () => {
    expect(displayMoney('12.34')).toBe('$12.34')
    expect(displayMoney('1500.00')).toBe('$1,500.00')
    expect(displayMoney(5)).toBe('$0.05')
  })

  it('puts the minus sign before the dollar sign', () => {
    expect(displayMoney('-33.33')).toBe('-$33.33')
    expect(displayMoney(-501)).toBe('-$5.01')
  })
})

describe('splitCents', () => {
  it('splits 100.00 three ways -> 33.34 / 33.33 / 33.33', () => {
    const shares = splitCents(parseCents('100.00'), [1, 2, 3])
    expect(shares.map((s) => formatCents(s.cents))).toEqual(['33.34', '33.33', '33.33'])
  })

  it('gives leftover cents to ascending user_id regardless of input order', () => {
    // 90.50 / 3 = 3016 r 2 -> users 2 and 5 get the extra cent
    const shares = splitCents(9050, [9, 5, 2])
    expect(shares).toEqual([
      { user_id: 2, cents: 3017 },
      { user_id: 5, cents: 3017 },
      { user_id: 9, cents: 3016 },
    ])
  })

  it('always sums exactly to the total', () => {
    for (const total of [1, 2, 99, 100, 101, 9050, 123457]) {
      for (const n of [1, 2, 3, 4, 7]) {
        const ids = Array.from({ length: n }, (_, i) => i + 1)
        const sum = splitCents(total, ids).reduce((acc, s) => acc + s.cents, 0)
        expect(sum).toBe(total)
      }
    }
  })

  it('rejects an empty participant list', () => {
    expect(() => splitCents(100, [])).toThrow()
  })
})
