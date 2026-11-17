/** Client-side form validation matching docs/api-contract.md §1.9. */

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
