import type { Location } from 'react-router-dom'
import type { RedirectState } from './ProtectedRoute'

const DEFAULT_AFTER_LOGIN = '/groups'

/** Where to go after login: the page the user originally tried to visit, or /groups. */
export function redirectTarget(location: Location): string {
  const from = (location.state as RedirectState | null)?.from
  if (!from?.pathname || from.pathname === '/login' || from.pathname === '/register') {
    return DEFAULT_AFTER_LOGIN
  }
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}
