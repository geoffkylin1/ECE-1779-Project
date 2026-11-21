import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setToken } from './api/token'
import { renderApp } from './test/render'

describe('routing', () => {
  it('redirects protected routes to /login when logged out', () => {
    const { pathname } = renderApp('/groups/1')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(pathname()).toBe('/login')
  })

  it('shows protected routes when a token is stored', async () => {
    setToken('mock-token-1')
    renderApp('/groups/1')
    expect(await screen.findByRole('heading', { name: 'Apartment 4B' })).toBeInTheDocument()
    await screen.findByTestId('current-user') // let /auth/me settle
  })

  it('sends / to /groups', async () => {
    setToken('mock-token-1')
    const { pathname } = renderApp('/')
    expect(screen.getByRole('heading', { name: 'My groups' })).toBeInTheDocument()
    expect(pathname()).toBe('/groups')
    await screen.findByTestId('current-user')
  })

  it('renders /register without a token', () => {
    renderApp('/register')
    expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', () => {
    renderApp('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
