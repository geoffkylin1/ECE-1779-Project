import { Link } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell'

export function NotFoundPage() {
  return (
    <AuthShell title="Page not found">
      <p className="text-gray-600">This page does not exist.</p>
      <Link to="/groups" className="mt-4 inline-block font-medium text-emerald-700 hover:underline">
        Go to my groups
      </Link>
    </AuthShell>
  )
}
