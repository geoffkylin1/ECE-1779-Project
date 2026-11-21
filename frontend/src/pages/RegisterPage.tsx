import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui/Button'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Input } from '../components/ui/Input'
import { errorMessage } from '../lib/errors'
import {
  DISPLAY_NAME_MAX,
  PASSWORD_MIN,
  validateRegister,
  type FieldErrors,
  type RegisterValues,
} from '../lib/validation'

const EMPTY: RegisterValues = { displayName: '', email: '', password: '', confirmPassword: '' }

export const DUPLICATE_EMAIL_MESSAGE = 'An account with this email already exists. Try logging in instead.'

export function RegisterPage() {
  const { isAuthenticated, register } = useAuth()
  const [values, setValues] = useState<RegisterValues>(EMPTY)
  // After the first submit attempt, errors update live as the user types.
  const [attempted, setAttempted] = useState(false)
  const [emailTaken, setEmailTaken] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/groups" replace />
  }

  const errors: FieldErrors<RegisterValues> = attempted ? validateRegister(values) : {}
  if (emailTaken && !errors.email) {
    errors.email = DUPLICATE_EMAIL_MESSAGE
  }

  const update = (field: keyof RegisterValues) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    if (field === 'email') setEmailTaken(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    if (Object.keys(validateRegister(values)).length > 0) {
      return
    }
    setFormError(null)
    setEmailTaken(false)
    setSubmitting(true)
    try {
      // Registers, then logs in with the same credentials; the <Navigate>
      // above then sends the user to /groups.
      await register({
        display_name: values.displayName.trim(),
        email: values.email.trim(),
        password: values.password,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEmailTaken(true)
      } else {
        setFormError(errorMessage(err))
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Create an account">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <ErrorMessage>{formError}</ErrorMessage>
        <Input
          label="Display name"
          name="display_name"
          autoComplete="nickname"
          value={values.displayName}
          onChange={(e) => update('displayName')(e.target.value)}
          error={errors.displayName}
          hint={`Shown to your group members (max ${DISPLAY_NAME_MAX} characters)`}
        />
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => update('email')(e.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => update('password')(e.target.value)}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN} characters`}
        />
        <Input
          label="Confirm password"
          type="password"
          name="confirm_password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => update('confirmPassword')(e.target.value)}
          error={errors.confirmPassword}
        />
        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-emerald-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}
