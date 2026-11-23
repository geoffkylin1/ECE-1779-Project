/**
 * Request validation for the mock API — the checks the real backend does
 * with Pydantic, which return 422 (contract §1.5, decision 2).
 * Each check returns an error message, or null when the value is valid.
 */

import { CATEGORIES, type Category } from '../api/types'
import { MAX_AMOUNT_CENTS, parseCents } from '../lib/money'

export type Body = Record<string, unknown>

const POSITIVE_MONEY = /^\d+(\.\d{1,2})?$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

/** Real calendar date in "YYYY-MM-DD" form. */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function checkRequired(body: Body, fields: string[]): string | null {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null)
  return missing.length > 0 ? `Missing required field(s): ${missing.join(', ')}` : null
}

export function checkText(value: unknown, field: string, min: number, max: number): string | null {
  if (typeof value !== 'string') {
    return `${field} must be a string`
  }
  const length = value.trim().length
  if (length < min || length > max) {
    return `${field} must be ${min}-${max} characters`
  }
  return null
}

export function checkEmail(value: unknown): string | null {
  if (typeof value !== 'string' || !EMAIL_PATTERN.test(value.trim())) {
    return 'email must be a valid email address'
  }
  return null
}

export function checkPassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 8) {
    return 'password must be at least 8 characters'
  }
  return null
}

/** Money must be a string, > 0, at most 2 decimals, at most "99999999.99" (decision 7). */
export function checkAmount(value: unknown, field = 'amount'): string | null {
  if (typeof value !== 'string') {
    return `${field} must be a decimal string, e.g. "12.34"`
  }
  if (!POSITIVE_MONEY.test(value.trim())) {
    return `${field} must be a positive decimal with at most 2 decimal places`
  }
  const cents = parseCents(value)
  if (cents <= 0) {
    return `${field} must be greater than 0`
  }
  if (cents > MAX_AMOUNT_CENTS) {
    return `${field} must be at most 99999999.99`
  }
  return null
}

export function checkDate(value: unknown, field = 'date'): string | null {
  return isValidDate(value) ? null : `${field} must be a valid date in YYYY-MM-DD format`
}

export function checkCategory(value: unknown): string | null {
  return isCategory(value) ? null : `category must be one of: ${CATEGORIES.join(', ')}`
}

/** note is optional; absent -> null; max 200 chars (decisions 17, 18). */
export function checkNote(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    return 'note must be a string'
  }
  return value.length > 200 ? 'note must be at most 200 characters' : null
}

export function checkUserId(value: unknown, field: string): string | null {
  return isInt(value) ? null : `${field} must be an integer`
}

/** Non-empty list of unique integer user ids (decision 8). */
export function checkParticipants(value: unknown): string | null {
  if (!Array.isArray(value) || !value.every(isInt)) {
    return 'participant_ids must be a list of integers'
  }
  if (value.length === 0) {
    return 'participant_ids must contain at least one user'
  }
  if (new Set(value).size !== value.length) {
    return 'participant_ids must not contain duplicates'
  }
  return null
}

/** First non-null message, or null. */
export function firstError(...errors: Array<string | null>): string | null {
  return errors.find((e) => e !== null) ?? null
}

export function normalizeNote(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}
