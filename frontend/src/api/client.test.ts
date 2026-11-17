import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../mocks/node'
import { getMe, login } from './auth'
import { ApiError, apiRequest, extractDetail, setUnauthorizedHandler } from './client'
import { getToken, setToken } from './token'

describe('apiRequest', () => {
  it('prefixes /api and sends the bearer token', async () => {
    let seen: { path: string; auth: string | null } | undefined
    server.use(
      http.get('*/api/echo', ({ request }) => {
        seen = { path: new URL(request.url).pathname, auth: request.headers.get('Authorization') }
        return HttpResponse.json({ ok: true })
      }),
    )
    setToken('abc')
    await expect(apiRequest('/echo')).resolves.toEqual({ ok: true })
    expect(seen).toEqual({ path: '/api/echo', auth: 'Bearer abc' })
  })

  it('omits the Authorization header when there is no token', async () => {
    let auth: string | null = 'unset'
    server.use(
      http.get('*/api/echo', ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    await apiRequest('/echo')
    expect(auth).toBeNull()
  })

  it('joins FastAPI list-shaped 422 details into one string', async () => {
    server.use(
      http.get('*/api/echo', () =>
        HttpResponse.json(
          { detail: [{ loc: ['body', 'amount'], msg: 'Field required', type: 'missing' }, { msg: 'Bad date' }] },
          { status: 422 },
        ),
      ),
    )
    const err = await apiRequest('/echo').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 422, detail: 'Field required; Bad date' })
  })

  it('falls back to a generic message when the body has no detail', () => {
    expect(extractDetail(undefined, 500)).toBe('Request failed with status 500')
  })
})

describe('401 handling', () => {
  it('clears the token and calls the unauthorized handler on an authenticated 401', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    setToken('mock-token-999') // well-formed token for a user that does not exist

    await expect(getMe()).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not redirect when login itself fails with 401', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    setToken('keep-me')

    await expect(login({ email: 'alice@test.com', password: 'nope-nope' })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(getToken()).toBe('keep-me')
  })
})
