import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getGroup } from '../api/groups'
import { useAuth } from '../auth/useAuth'
import { GroupDashboard } from '../components/group/GroupDashboard'
import { YouBadge } from '../components/group/YouBadge'
import { JoinCode } from '../components/JoinCode'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Spinner } from '../components/ui/Spinner'
import { useApi } from '../hooks/useApi'
import { errorMessage } from '../lib/errors'
import { memberCountLabel } from '../lib/format'

export const NOT_MEMBER_MESSAGE = 'You are not a member of this group'
export const GROUP_NOT_FOUND_MESSAGE = 'Group not found'

/** Group detail: header (name, join code, members), balances, forms and history. */
export function GroupDetailPage() {
  const { groupId } = useParams()
  const { user } = useAuth()
  const id = Number(groupId)
  const validId = Number.isInteger(id) && id > 0

  const { data: group, error, loading, refetch } = useApi(
    () => (validId ? getGroup(id) : Promise.reject(new ApiError(404, GROUP_NOT_FOUND_MESSAGE))),
    [id, validId],
  )

  return (
    <div className="space-y-6">
      <Link
        to="/groups"
        className="inline-flex items-center gap-1 rounded text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600"
      >
        <span aria-hidden="true">←</span> Back to groups
      </Link>

      {group ? (
        <>
          <h1 className="text-2xl font-semibold break-words text-gray-900" title={group.name}>{group.name}</h1>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card title="Join code">
              <JoinCode code={group.join_code} />
              <p className="text-sm text-gray-600">
                Share this code with your roommates so they can join.
              </p>
            </Card>

            <Card title={`Members (${group.members.length})`} className="min-w-0">
              <ul className="divide-y divide-gray-100" aria-label="Members">
                {group.members.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex min-w-0 items-center gap-2 py-2 text-gray-800 first:pt-0 last:pb-0"
                  >
                    <span className="truncate" title={m.display_name}>
                      {m.display_name}
                    </span>
                    {m.user_id === user?.id && <YouBadge />}
                  </li>
                ))}
              </ul>
              <p className="sr-only">{memberCountLabel(group.members.length)}</p>
            </Card>
          </div>

          <GroupDashboard group={group} />
        </>
      ) : loading ? (
        <Spinner label="Loading group…" showLabel className="text-gray-500" />
      ) : (
        <GroupError error={error} onRetry={refetch} />
      )}
    </div>
  )
}

function GroupError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    const forbidden = error.status === 403
    return (
      <Card>
        {/* role="alert" on a wrapper: putting it on the <h1> would drop its heading role. */}
        <div role="alert">
          <h1 className="text-xl font-semibold text-gray-900">
            {forbidden ? NOT_MEMBER_MESSAGE : GROUP_NOT_FOUND_MESSAGE}
          </h1>
          <p className="mt-2 text-gray-600">
            {forbidden
              ? 'Ask a member for the join code, then join from My groups.'
              : 'The link may be wrong, or the group no longer exists.'}
          </p>
        </div>
      </Card>
    )
  }
  return (
    <div className="space-y-3">
      <ErrorMessage>Could not load this group: {errorMessage(error)}</ErrorMessage>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
