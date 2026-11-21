import { Link } from 'react-router-dom'
import type { GroupSummary } from '../../api/types'
import { memberCountLabel } from '../../lib/format'

/** Clickable card for one group in the list. */
export function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-gray-900">{group.name}</span>
          <span className="mt-1 block text-sm text-gray-500">{memberCountLabel(group.member_count)}</span>
        </span>
        <span aria-hidden="true" className="text-gray-300 transition group-hover:text-emerald-500">
          →
        </span>
      </span>
    </Link>
  )
}
