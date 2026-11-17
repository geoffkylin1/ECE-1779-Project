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
