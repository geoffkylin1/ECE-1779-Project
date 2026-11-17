import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { getToken, setToken } from '../api/token'
import { renderApp } from '../test/render'

describe('Layout', () => {
  it('shows the logo and the current user from /api/auth/me', async () => {
    setToken('mock-token-2')
    renderApp('/groups/1')

    expect(await screen.findByTestId('current-user')).toHaveTextContent('Bob')
    expect(screen.getByRole('link', { name: 'SplitMate' })).toHaveAttribute('href', '/groups')
  })

  it('logout clears the token and user and returns to /login', async () => {
    setToken('mock-token-1')
    const { user, pathname } = renderApp('/groups/1')
    await screen.findByTestId('current-user')

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(pathname()).toBe('/login')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(getToken()).toBeNull()
    expect(screen.queryByTestId('current-user')).not.toBeInTheDocument()
  })

  it('after logout, logging in again goes to /groups (not the last page)', async () => {
    setToken('mock-token-1')
    const { user, pathname } = renderApp('/groups/1')
    await screen.findByTestId('current-user')
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await user.type(screen.getByLabelText('Email'), 'bob@test.com')
    await user.type(screen.getByLabelText('Password'), 'password123{Enter}')

    expect(await screen.findByTestId('current-user')).toHaveTextContent('Bob')
    expect(pathname()).toBe('/groups')
  })
})
