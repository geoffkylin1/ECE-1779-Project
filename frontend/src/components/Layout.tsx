import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

/** Shell for logged-in pages: top bar + centered content (max ~960px). */
export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[960px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/groups"
            className="shrink-0 rounded text-lg font-bold tracking-tight text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            SplitMate
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {user ? (
              <span
                className="truncate text-sm font-medium text-gray-700"
                title={user.display_name}
                data-testid="current-user"
              >
                {user.display_name}
              </span>
            ) : (
              <Spinner label="Loading user" className="text-gray-400" />
            )}
            <Button variant="secondary" size="sm" onClick={logout} className="shrink-0">
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[960px] px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
