import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getToken } from '../api/token'
import { renderApp } from '../test/render'
import { DUPLICATE_EMAIL_MESSAGE } from './RegisterPage'

function fields() {
  return {
    name: screen.getByLabelText('Display name'),
    email: screen.getByLabelText('Email'),
    password: screen.getByLabelText('Password'),
    confirm: screen.getByLabelText('Confirm password'),
    submit: screen.getByRole('button', { name: 'Create account' }),
  }
}

describe('RegisterPage', () => {
  it('shows a validation error under each invalid field', async () => {
    const { user, pathname } = renderApp('/register')
    const f = fields()

    await user.click(f.submit)
    expect(screen.getByText('Display name is required')).toHaveAttribute('role', 'alert')
    expect(screen.getByText('Email is required')).toHaveAttribute('role', 'alert')
    expect(screen.getByText('Password must be at least 8 characters')).toHaveAttribute('role', 'alert')

    await user.type(f.name, 'x'.repeat(31))
    await user.type(f.email, 'not-an-email')
    await user.type(f.password, 'short')
    await user.type(f.confirm, 'different')

    expect(screen.getByText('Display name must be at most 30 characters')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()

    // Each error is linked to its input.
    const emailError = screen.getByText('Enter a valid email address')
    expect(f.email).toHaveAttribute('aria-invalid', 'true')
    expect(f.email).toHaveAttribute('aria-describedby', emailError.id)

    expect(pathname()).toBe('/register')
  })

  it('shows a friendly message on the email field for a duplicate email (409)', async () => {
    const { user, pathname } = renderApp('/register')
    const f = fields()

    await user.type(f.name, 'Another Alice')
    await user.type(f.email, 'Alice@Test.com')
    await user.type(f.password, 'password123')
    await user.type(f.confirm, 'password123{Enter}')

    const message = await screen.findByText(DUPLICATE_EMAIL_MESSAGE)
    expect(message).toHaveAttribute('role', 'alert')
    expect(f.email).toHaveAttribute('aria-describedby', message.id)
    expect(pathname()).toBe('/register')
    expect(getToken()).toBeNull()

    // Editing the email clears the server error.
    await user.type(f.email, 'x')
    expect(screen.queryByText(DUPLICATE_EMAIL_MESSAGE)).not.toBeInTheDocument()
  })

  it('registers, logs in automatically and lands on /groups', async () => {
    const { user, pathname } = renderApp('/register')
    const f = fields()

    await user.type(f.name, '  Erin  ')
    await user.type(f.email, 'erin@test.com')
    await user.type(f.password, 'longenough')
    await user.type(f.confirm, 'longenough')
    await user.click(f.submit)

    expect(await screen.findByRole('heading', { name: 'My groups' })).toBeInTheDocument()
    expect(pathname()).toBe('/groups')
    expect(screen.getByTestId('current-user')).toHaveTextContent(/^Erin$/)
    expect(getToken()).toBe('mock-token-5')
  })

  it('links to /login', async () => {
    const { user, pathname } = renderApp('/register')
    await user.click(screen.getByRole('link', { name: 'Log in' }))
    expect(pathname()).toBe('/login')
  })
})
