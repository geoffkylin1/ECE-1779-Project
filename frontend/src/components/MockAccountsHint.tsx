import { SEED_ACCOUNTS, SEED_ACCOUNT_PASSWORD } from './mock-accounts'

/**
 * Lists the mock seed accounts. Rendered only when VITE_USE_MOCK=true;
 * clicking an account fills the login form.
 */
export function MockAccountsHint({ onPick }: { onPick?: (email: string, password: string) => void }) {
  if (import.meta.env.VITE_USE_MOCK !== 'true') {
    return null
  }
  return (
    <aside
      aria-label="Mock accounts"
      className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p className="font-medium">Mock mode — seed accounts</p>
      <p className="mt-0.5 text-amber-800">
        Password for all: <code className="font-mono">{SEED_ACCOUNT_PASSWORD}</code>
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {SEED_ACCOUNTS.map((email) => (
          <li key={email}>
            <button
              type="button"
              onClick={() => onPick?.(email, SEED_ACCOUNT_PASSWORD)}
              className="rounded-md bg-white px-2 py-1 font-mono text-xs ring-1 ring-amber-200 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-500"
            >
              {email}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
