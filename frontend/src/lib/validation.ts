/** Client-side form validation matching docs/api-contract.md §1.9. */
import { isValidMoney, MAX_AMOUNT_CENTS, parseCents } from './money'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const DISPLAY_NAME_MAX = 30
export const PASSWORD_MIN = 8

export interface RegisterValues {
  displayName: string
  email: string
  password: string
  confirmPassword: string
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function validateRegister(values: RegisterValues): FieldErrors<RegisterValues> {
  const errors: FieldErrors<RegisterValues> = {}
  const name = values.displayName.trim()

  if (name.length === 0) {
    errors.displayName = 'Display name is required'
  } else if (name.length > DISPLAY_NAME_MAX) {
    errors.displayName = `Display name must be at most ${DISPLAY_NAME_MAX} characters`
  }

  if (values.email.trim() === '') {
    errors.email = 'Email is required'
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Enter a valid email address'
  }

  if (values.password.length < PASSWORD_MIN) {
    errors.password = `Password must be at least ${PASSWORD_MIN} characters`
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match'
  }

  return errors
}

export interface LoginValues {
  email: string
  password: string
}

export function validateLogin(values: LoginValues): FieldErrors<LoginValues> {
  const errors: FieldErrors<LoginValues> = {}
  if (values.email.trim() === '') {
    errors.email = 'Email is required'
  }
  if (values.password === '') {
    errors.password = 'Password is required'
  }
  return errors
}

// ---------- Groups ----------

export const GROUP_NAME_MAX = 50
export const JOIN_CODE_LENGTH = 8

/** Group name: 1–50 characters after trimming (contract §1.9). */
export function validateGroupName(name: string): string | undefined {
  const length = name.trim().length
  if (length === 0) return 'Group name is required'
  if (length > GROUP_NAME_MAX) return `Group name must be at most ${GROUP_NAME_MAX} characters`
  return undefined
}

/** Join codes are case-insensitive and 8 chars: strip whitespace, uppercase, cap length. */
export function normalizeJoinCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase().slice(0, JOIN_CODE_LENGTH)
}

// ---------- Money / expenses / settlements ----------

export const NOTE_MAX = 200

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/

/**
 * Amount entered by a user (contract §1.3): > 0, at most 2 decimals,
 * at most "99999999.99". Returns an error message or undefined.
 */
export function validateAmount(value: string): string | undefined {
  const v = value.trim()
  if (v === '') return 'Amount is required'
  if (!AMOUNT_PATTERN.test(v)) return 'Enter an amount like 12.34'
  if (!isValidMoney(v)) return 'Use at most 2 decimal places'
  const cents = parseCents(v)
  if (cents <= 0) return 'Amount must be greater than 0'
  if (cents > MAX_AMOUNT_CENTS) return 'Amount must be at most 99,999,999.99'
  return undefined
}

/** Optional note, max 200 characters after trimming (contract §1.9). */
export function validateNote(value: string): string | undefined {
  return value.trim().length > NOTE_MAX ? `Note must be at most ${NOTE_MAX} characters` : undefined
}

/** Trimmed note, or null when empty (the API returns null for absent notes). */
export function normalizeNote(value: string): string | null {
  const v = value.trim()
  return v === '' ? null : v
}

export const INVALID_JOIN_CODE_MESSAGE = 'Join codes are 8 letters or digits'
const JOIN_CODE_PATTERN = /^[A-Z0-9]{8}$/

/** A normalized join code must be exactly 8 of A–Z / 0–9 (contract §1.9). */
export function isValidJoinCode(code: string): boolean {
  return JOIN_CODE_PATTERN.test(code)
}
