import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { getGroup, joinGroup } from '../../api/groups'
import type { GroupSummary } from '../../api/types'
import { errorMessage } from '../../lib/errors'
import { INVALID_JOIN_CODE_MESSAGE, isValidJoinCode, normalizeJoinCode } from '../../lib/validation'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'

export const NOT_FOUND_MESSAGE = 'No group found with that code'
export const ALREADY_MEMBER_MESSAGE = "You're already in this group"

/**
 * GET /api/groups does not include join codes (contract §4.3), so to link to
 * the group after a 409 we look up each of the caller's groups by id.
 */
async function findGroupByCode(
  groups: readonly GroupSummary[],
  code: string,
): Promise<{ id: number; name: string } | null> {
  const details = await Promise.allSettled(groups.map((g) => getGroup(g.id)))
  for (const result of details) {
    if (result.status === 'fulfilled' && result.value.join_code === code) {
      return { id: result.value.id, name: result.value.name }
    }
  }
  return null
}

/** "Join with code" form. On success navigates to the joined group. */
export function JoinGroupForm({ myGroups }: { myGroups: readonly GroupSummary[] | undefined }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<ReactNode>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (code.length === 0) {
      setError('Enter a join code')
      return
    }
    // The backend answers 422 for anything else; don't send it.
    if (!isValidJoinCode(code)) {
      setError(INVALID_JOIN_CODE_MESSAGE)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const group = await joinGroup(code)
      navigate(`/groups/${group.id}`)
    } catch (err) {
      setError(await describeJoinError(err, code, myGroups ?? []))
      setSubmitting(false)
    }
  }

  return (
    <Card title="Join with code">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Join code"
          name="join_code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="K7Q2ZP4M"
          // No maxLength: it would truncate a pasted "  k7q2zp4m  " before
          // normalizeJoinCode strips the spaces. The normalizer caps at 8.
          className="[&_input]:font-mono [&_input]:tracking-widest"
          value={code}
          onChange={(e) => {
            setCode(normalizeJoinCode(e.target.value))
            setError(null)
          }}
          error={error}
          hint="8 letters or digits, from a group member"
        />
        <Button type="submit" variant="secondary" loading={submitting}>
          {submitting ? 'Joining…' : 'Join group'}
        </Button>
      </form>
    </Card>
  )
}

async function describeJoinError(
  err: unknown,
  code: string,
  myGroups: readonly GroupSummary[],
): Promise<ReactNode> {
  if (!(err instanceof ApiError)) {
    return errorMessage(err)
  }
  switch (err.status) {
    case 404:
      return NOT_FOUND_MESSAGE
    case 409: {
      const group = await findGroupByCode(myGroups, code)
      if (!group) {
        return `${ALREADY_MEMBER_MESSAGE}.`
      }
      return (
        <>
          {ALREADY_MEMBER_MESSAGE}.{' '}
          <Link to={`/groups/${group.id}`} className="font-medium underline">
            Open {group.name}
          </Link>
        </>
      )
    }
    default:
      // 422 and anything else: the API detail is a readable string.
      return errorMessage(err)
  }
}
