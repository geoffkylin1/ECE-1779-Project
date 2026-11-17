/**
 * Small fetch wrapper for the SplitMate API (docs/api-contract.md).
 *
 * - Prefixes every path with /api
 * - Adds "Authorization: Bearer <token>" when a token is stored
 * - Parses JSON and throws ApiError {status, detail: string} on non-2xx
 * - On 401 from an authenticated call: clears the token and redirects to /login
 */

import type { ErrorResponse, ValidationErrorItem } from './types'
import { clearToken, getToken } from './token'

export const API_PREFIX = '/api'

export class ApiError extends Error {
  /** HTTP status, or 0 for network failures. */
  readonly status: number
  /** Always a string, even if the server sent FastAPI's list-shaped 422 detail. */
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// ---------- 401 handling ----------

type UnauthorizedHandler = () => void

const redirectToLogin: UnauthorizedHandler = () => {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

let unauthorizedHandler: UnauthorizedHandler = redirectToLogin

/**
 * Override what happens after a 401 on an authenticated call (the token is
 * already cleared). AuthProvider uses this to navigate with React Router
 * instead of a full page reload. Pass null to restore the default redirect.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler ?? redirectToLogin
}

// ---------- Request ----------

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Serialized as JSON. */
  body?: unknown
  /** Undefined or empty-string values are skipped. */
  query?: Record<string, string | undefined>
  /** Send the bearer token and treat 401 as "session expired". Default true. */
  auth?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options

  const url = new URL(API_PREFIX + path, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  const headers = new Headers({ Accept: 'application/json' })
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const token = auth ? getToken() : null
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Network error: could not reach the server')
  }

  const data = await readJson(response)

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearToken()
      unauthorizedHandler()
    }
    throw new ApiError(response.status, extractDetail(data, response.status))
  }

  return data as T
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return undefined
  }
  try {
    return JSON.parse(text)
  } catch {
    if (response.ok) {
      throw new ApiError(response.status, 'Server returned invalid JSON')
    }
    return undefined
  }
}

/** Turn any error body into a single string (contract §1.5). */
export function extractDetail(data: unknown, status: number): string {
  const detail = (data as Partial<ErrorResponse> | undefined)?.detail
  if (typeof detail === 'string' && detail) {
    return detail
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item: Partial<ValidationErrorItem>) => item?.msg)
      .filter((msg): msg is string => typeof msg === 'string' && msg.length > 0)
    if (messages.length > 0) {
      return messages.join('; ')
    }
  }
  return `Request failed with status ${status}`
}
