import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin } from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'
import { clearToken, getToken, setToken } from '../api/token'
import { AuthContext, type AuthContextValue } from './auth-context'

/** Holds the token (persisted in localStorage). Must be rendered inside a Router. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [token, setTokenState] = useState<string | null>(() => getToken())

  // On 401 from any authenticated call, the client clears the token; we sync
  // state and go to /login without a full page reload.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTokenState(null)
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin({ email, password })
    setToken(response.access_token)
    setTokenState(response.access_token)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ token, isAuthenticated: token !== null, login, logout }),
    [token, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
