import { screen, waitFor, within } from '@testing-library/react'
import { delay, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getToken, setToken } from '../api/token'
import { SEED_ACCOUNT_PASSWORD, SEED_ACCOUNTS } from '../components/mock-accounts'
import { db, SEED_PASSWORD } from '../mocks/db'
import { server } from '../mocks/node'
import { renderApp } from '../test/render'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('LoginPage', () => {
  it('logs in, navigates to /groups and shows the display name', async () => {
    const { user, pathname } = renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'alice@test.com')
    // Submitting with Enter (no button click).
    await user.type(screen.getByLabelText('Password'), 'password123{Enter}')

    expect(await screen.findByRole('heading', { name: 'My groups' })).toBeInTheDocument()
    expect(pathname()).toBe('/groups')
    expect(screen.getByTestId('current-user')).toHaveTextContent('Alice')
    expect(getToken()).toBe('mock-token-1')
  })

  it('shows the API error detail for a wrong password', async () => {
    const { user, pathname } = renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'alice@test.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
    expect(pathname()).toBe('/login')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
    expect(getToken()).toBeNull()
  })

  it('disables the button while submitting', async () => {
    // Slow down login; returning nothing falls through to the real mock handler.
    server.use(
      http.post('*/api/auth/login', async () => {
        await delay(100)
      }),
    )
    const { user } = renderApp('/login')

    await user.type(screen.getByLabelText('Email'), 'bob@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const busy = screen.getByRole('button', { name: /logging in/i })
    expect(busy).toBeDisabled()
    expect(await screen.findByTestId('current-user')).toHaveTextContent('Bob')
  })

  it('shows required-field errors without calling the API', async () => {
    const { user } = renderApp('/login')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const alerts = screen.getAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toEqual(['Email is required', 'Password is required'])
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('redirects to /groups when already logged in', async () => {
    setToken('mock-token-1')
    const { pathname } = renderApp('/login')
    expect(await screen.findByRole('heading', { name: 'My groups' })).toBeInTheDocument()
    expect(pathname()).toBe('/groups')
  })

  it('links to /register', async () => {
    const { user, pathname } = renderApp('/login')
    await user.click(screen.getByRole('link', { name: 'Create one' }))
    expect(pathname()).toBe('/register')
  })
})

describe('redirect back after login', () => {
  it('visiting /groups logged out goes to /login, then back to /groups after login', async () => {
    const { user, pathname } = renderApp('/groups')

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(pathname()).toBe('/login')

    await user.type(screen.getByLabelText('Email'), 'carol@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123{Enter}')

    expect(await screen.findByRole('heading', { name: 'My groups' })).toBeInTheDocument()
    expect(pathname()).toBe('/groups')
  })

  it('returns to a deep link such as /groups/1', async () => {
    const { user, pathname } = renderApp('/groups/1')
    expect(pathname()).toBe('/login')

    await user.type(screen.getByLabelText('Email'), 'alice@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123{Enter}')

    expect(await screen.findByRole('heading', { name: 'Apartment 4B' })).toBeInTheDocument()
    expect(pathname()).toBe('/groups/1')
  })

  it('an expired/invalid token sends the user to /login and clears it', async () => {
    setToken('mock-token-999') // well-formed, but no such user -> 401 from /auth/me
    const { pathname } = renderApp('/groups/1')

    await waitFor(() => expect(pathname()).toBe('/login'))
    expect(getToken()).toBeNull()
  })
})

describe('mock accounts hint', () => {
  it('is hidden unless VITE_USE_MOCK is "true"', () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    renderApp('/login')
    expect(screen.queryByRole('complementary', { name: 'Mock accounts' })).not.toBeInTheDocument()
  })

  it('lists the seed accounts in mock mode and fills the form on click', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { user } = renderApp('/login')

    const hint = screen.getByRole('complementary', { name: 'Mock accounts' })
    for (const email of ['alice@test.com', 'bob@test.com', 'carol@test.com', 'dave@test.com']) {
      expect(within(hint).getByRole('button', { name: email })).toBeInTheDocument()
    }
    expect(hint).toHaveTextContent('password123')

    await user.click(within(hint).getByRole('button', { name: 'dave@test.com' }))
    expect(screen.getByLabelText('Email')).toHaveValue('dave@test.com')
    expect(screen.getByLabelText('Password')).toHaveValue('password123')
  })

  it('matches the mock database seed', () => {
    expect(SEED_ACCOUNT_PASSWORD).toBe(SEED_PASSWORD)
    for (const email of SEED_ACCOUNTS) {
      expect(db.users.some((u) => u.email === email)).toBe(true)
    }
  })
})
