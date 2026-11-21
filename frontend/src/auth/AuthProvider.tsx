import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getMe, login as apiLogin, register as apiRegister } from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'
import { clearToken, getToken, setToken } from '../api/token'
import type { RegisterRequest, User } from '../api/types'
import { AuthContext, type AuthContextValue } from './auth-context'

/**
 * Holds the token (persisted in localStorage) and current user.
 *
 * Redirects are not done here: when the token goes away (logout or 401),
 * ProtectedRoute renders <Navigate to="/login">. Must be inside a Router.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<User | null>(null)
  const [loggedOut, setLoggedOut] = useState(false)

  // On 401 from any authenticated call the client has already cleared the
  // stored token. Dropping it from state makes ProtectedRoute redirect to
  // /login, remembering the current page so the user returns after logging in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setTokenState(null)
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Page loaded with a stored token: fetch the user it belongs to.
  useEffect(() => {
    if (!token || user) {
      return
    }
    let cancelled = false
    getMe()
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        // 401 is handled by the unauthorized handler above; on other errors
        // (e.g. network) stay logged in and let the next request retry.
      })
    return () => {
      cancelled = true
    }
  }, [token, user])

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await apiLogin({ email, password })
    setToken(access_token) // getMe() reads the token from storage
    try {
      const me = await getMe()
      // Set together so the app never sees "logged in, no user yet".
      setUser(me)
      setTokenState(access_token)
      setLoggedOut(false)
    } catch (err) {
      clearToken()
      throw err
    }
  }, [])

  const register = useCallback(
    async (body: RegisterRequest) => {
      await apiRegister(body)
      await login(body.email, body.password)
    },
    [login],
  )

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setUser(null)
    setLoggedOut(true)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, isAuthenticated: token !== null, loggedOut, login, register, logout }),
    [token, user, loggedOut, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
