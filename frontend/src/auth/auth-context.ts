import { createContext } from 'react'
import type { RegisterRequest, User } from '../api/types'

export interface AuthContextValue {
  /** Bearer token, mirrored in localStorage. */
  token: string | null
  /** Current user from GET /api/auth/me; null while loading or when logged out. */
  user: User | null
  isAuthenticated: boolean
  /**
   * True after an explicit logout (until the next login). ProtectedRoute uses
   * it to skip "return to this page after login" — that only makes sense when
   * the session expired, not when the user chose to leave.
   */
  loggedOut: boolean
  /** POST /api/auth/login, store the token, then load /api/auth/me. Throws ApiError. */
  login: (email: string, password: string) => Promise<void>
  /** POST /api/auth/register, then log in with the same credentials. Throws ApiError. */
  register: (body: RegisterRequest) => Promise<void>
  /** Clear token and user; ProtectedRoute then sends the user to /login. */
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
