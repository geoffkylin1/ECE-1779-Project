import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { setToken } from './api/token'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routing', () => {
  it('redirects protected routes to /login when logged out', () => {
    renderAt('/groups/1')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('shows protected routes when a token is stored', () => {
    setToken('mock-token-1')
    renderAt('/groups/1')
    expect(screen.getByRole('heading', { name: 'Group 1' })).toBeInTheDocument()
  })

  it('sends / to /groups', () => {
    setToken('mock-token-1')
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'My groups' })).toBeInTheDocument()
  })

  it('renders /register without a token', () => {
    renderAt('/register')
    expect(screen.getByRole('heading', { name: 'Create an account' })).toBeInTheDocument()
  })
})
