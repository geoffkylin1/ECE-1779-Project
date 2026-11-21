import { useState } from 'react'
import { listGroups } from '../api/groups'
import type { GroupSummary } from '../api/types'
import { CreateGroupPanel } from '../components/groups/CreateGroupPanel'
import { GroupCard } from '../components/groups/GroupCard'
import { JoinGroupForm } from '../components/groups/JoinGroupForm'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Spinner } from '../components/ui/Spinner'
import { useApi } from '../hooks/useApi'
import { errorMessage } from '../lib/errors'

export const EMPTY_GROUPS_MESSAGE = "You're not in any groups yet — create one or join with a code"

export function GroupsPage() {
  const { data: groups, error, loading, refetch } = useApi(listGroups, [])
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">My groups</h1>
        {!creating && <Button onClick={() => setCreating(true)}>New group</Button>}
      </div>

      {creating && <CreateGroupPanel onCreated={refetch} onClose={() => setCreating(false)} />}

      <section aria-labelledby="group-list-heading">
        <h2 id="group-list-heading" className="sr-only">
          Group list
        </h2>
        <GroupList groups={groups} error={error} loading={loading} onRetry={refetch} />
      </section>

      <div className="sm:max-w-md">
        <JoinGroupForm myGroups={groups} />
      </div>
    </div>
  )
}

interface GroupListProps {
  groups: GroupSummary[] | undefined
  error: unknown
  loading: boolean
  onRetry: () => void
}

function GroupList({ groups, error, loading, onRetry }: GroupListProps) {
  const errorBox = error ? (
    <div className="space-y-3">
      <ErrorMessage>Could not load your groups: {errorMessage(error)}</ErrorMessage>
      <Button variant="secondary" size="sm" onClick={onRetry} loading={loading}>
        Retry
      </Button>
    </div>
  ) : null

  if (!groups) {
    if (errorBox) return errorBox
    return <Spinner label="Loading groups…" showLabel className="text-gray-500" />
  }

  return (
    <div className="space-y-4">
      {errorBox}
      {groups.length === 0 ? (
        <Card>
          <p className="text-gray-600">{EMPTY_GROUPS_MESSAGE}.</p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupCard group={group} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
