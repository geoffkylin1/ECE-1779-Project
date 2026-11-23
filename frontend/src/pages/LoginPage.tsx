import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { redirectTarget } from '../auth/redirect'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { MockAccountsHint } from '../components/MockAccountsHint'
import { Button } from '../components/ui/Button'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Input } from '../components/ui/Input'
import { errorMessage } from '../lib/errors'
import { validateLogin, type FieldErrors, type LoginValues } from '../lib/validation'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginValues>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already logged in, or login just succeeded: go to the page the user
  // originally wanted (set by ProtectedRoute), or /groups.
  if (isAuthenticated) {
    return <Navigate to={redirectTarget(location)} replace />
  }

  const update = (field: keyof LoginValues) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    setFieldErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateLogin(values)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      await login(values.email.trim(), values.password)
      // Success: isAuthenticated flips and the <Navigate> above takes over.
    } catch (err) {
      setFormError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Log in">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <ErrorMessage>{formError}</ErrorMessage>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => update('email')(e.target.value)}
          error={fieldErrors.email}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => update('password')(e.target.value)}
          error={fieldErrors.password}
        />
        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-600">
        No account yet?{' '}
        <Link to="/register" className="font-medium text-emerald-700 hover:underline">
          Create one
        </Link>
      </p>

      <MockAccountsHint
        onPick={(email, password) => {
          setValues({ email, password })
          setFieldErrors({})
          setFormError(null)
        }}
      />
    </AuthShell>
  )
}
