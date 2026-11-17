import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom'
import { useAuth } from './useAuth'

/** Router state set when redirecting to /login, so login can send the user back. */
export interface RedirectState {
  from?: Pick<Location, 'pathname' | 'search' | 'hash'>
}

/**
 * Layout route: renders child routes when logged in, otherwise redirects to /login.
 * Remembers the current page (so login can return to it) unless the user just
 * logged out on purpose.
 */
export function ProtectedRoute() {
  const { isAuthenticated, loggedOut } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    const state: RedirectState | undefined = loggedOut
      ? undefined
      : { from: { pathname: location.pathname, search: location.search, hash: location.hash } }
    return <Navigate to="/login" replace state={state} />
  }
  return <Outlet />
}
