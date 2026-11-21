import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createGroup } from '../../api/groups'
import type { CreatedGroup } from '../../api/types'
import { errorMessage } from '../../lib/errors'
import { validateGroupName } from '../../lib/validation'
import { JoinCode } from '../JoinCode'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ErrorMessage } from '../ui/ErrorMessage'
import { Input } from '../ui/Input'

interface CreateGroupPanelProps {
  /** Called after the group is created (e.g. to refresh the list). */
  onCreated: (group: CreatedGroup) => void
  onClose: () => void
}

/** Inline "New group" form; after success shows the join code to share. */
export function CreateGroupPanel({ onCreated, onClose }: CreateGroupPanelProps) {
  const [name, setName] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<CreatedGroup | null>(null)

  const nameError = attempted ? validateGroupName(name) : undefined

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    if (validateGroupName(name)) {
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const group = await createGroup({ name: name.trim() })
      setCreated(group)
      onCreated(group)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <Card aria-labelledby="group-created-title">
        <h2 id="group-created-title" className="text-lg font-semibold text-gray-900">
          “{created.name}” created
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Share this code with your roommates so they can join.
        </p>
        <div className="mt-4">
          <JoinCode code={created.join_code} size="lg" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to={`/groups/${created.id}`}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Open group
          </Link>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card title="New group">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <ErrorMessage>{formError}</ErrorMessage>
        <Input
          label="Group name"
          name="name"
          autoComplete="off"
          placeholder="e.g. Apartment 4B"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          hint="1–50 characters"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={submitting}>
            {submitting ? 'Creating…' : 'Create group'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}
