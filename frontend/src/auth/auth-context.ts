import { createContext } from 'react'

export interface AuthContextValue {
  /** Bearer token, mirrored in localStorage. */
  token: string | null
  isAuthenticated: boolean
  /** Calls POST /api/auth/login and stores the token. Throws ApiError on failure. */
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
