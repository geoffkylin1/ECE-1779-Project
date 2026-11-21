import { apiRequest } from './client'
import type { HealthResponse, LoginRequest, LoginResponse, RegisterRequest, User } from './types'

/** GET /api/health (no auth) — contract §4.1 */
export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health', { auth: false })
}

/** POST /api/auth/register (no auth) -> 201 User — contract §4.2 */
export function register(body: RegisterRequest): Promise<User> {
  return apiRequest<User>('/auth/register', { method: 'POST', body, auth: false })
}

/**
 * POST /api/auth/login (no auth) — contract §4.2
 * auth: false so a wrong password (401) does not trigger the session-expired redirect.
 */
export function login(body: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body, auth: false })
}

/** GET /api/auth/me — contract §4.2 */
export function getMe(): Promise<User> {
  return apiRequest<User>('/auth/me')
}
