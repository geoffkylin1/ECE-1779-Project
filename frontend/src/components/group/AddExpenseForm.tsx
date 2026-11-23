import { useId, useState, type FormEvent } from 'react'
import { createExpense } from '../../api/expenses'
import { CATEGORIES, type Category, type GroupMember } from '../../api/types'
import { memberName } from '../../lib/balances'
import { todayLocal } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import { categoryLabel } from '../../lib/format'
import { displayMoney, normalizeMoney, parseCents, splitCents } from '../../lib/money'
import {
  NOTE_MAX,
  normalizeNote,
  validateAmount,
  validateNote,
  type FieldErrors,
} from '../../lib/validation'
import { Button } from '../ui/Button'
import { ErrorMessage } from '../ui/ErrorMessage'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

interface Values {
  amount: string
  payerId: number
  participantIds: number[]
  category: Category
  date: string
  note: string
}

type Errors = FieldErrors<Values>

export const NO_PARTICIPANTS_MESSAGE = 'Choose at least one participant'

function initialValues(members: readonly GroupMember[], currentUserId: number | undefined): Values {
  const isMember = members.some((m) => m.user_id === currentUserId)
  return {
    amount: '',
    payerId: isMember && currentUserId !== undefined ? currentUserId : (members[0]?.user_id ?? 0),
    participantIds: members.map((m) => m.user_id),
    category: 'groceries',
    date: todayLocal(),
    note: '',
  }
}

function validate(values: Values): Errors {
  const errors: Errors = {}
  const amount = validateAmount(values.amount)
  if (amount) errors.amount = amount
  if (values.participantIds.length === 0) errors.participantIds = NO_PARTICIPANTS_MESSAGE
  if (!values.date) errors.date = 'Date is required'
  const note = validateNote(values.note)
  if (note) errors.note = note
  return errors
}

interface AddExpenseFormProps {
  groupId: number
  members: readonly GroupMember[]
  currentUserId: number | undefined
  onCreated: () => void
}

/** POST /expenses with a live preview of the even split. */
export function AddExpenseForm({ groupId, members, currentUserId, onCreated }: AddExpenseFormProps) {
  const [values, setValues] = useState(() => initialValues(members, currentUserId))
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const participantsErrorId = useId()

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setServerError(null)
    setSuccess(null)
  }

  function toggleParticipant(userId: number, checked: boolean) {
    const ids = checked
      ? [...values.participantIds, userId]
      : values.participantIds.filter((id) => id !== userId)
    update('participantIds', ids)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    setSuccess(null)
    if (Object.values(found).some(Boolean)) return

    setSubmitting(true)
    setServerError(null)
    try {
      const expense = await createExpense(groupId, {
        amount: normalizeMoney(values.amount),
        payer_id: values.payerId,
        participant_ids: [...values.participantIds].sort((a, b) => a - b),
        category: values.category,
        date: values.date,
        note: normalizeNote(values.note),
      })
      setValues(initialValues(members, currentUserId))
      setSuccess(`Added ${displayMoney(expense.amount)} ${categoryLabel(expense.category).toLowerCase()} expense.`)
      onCreated()
    } catch (err) {
      setServerError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const allSelected = values.participantIds.length === members.length

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Add expense">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={values.amount}
          onChange={(e) => update('amount', e.target.value)}
          error={errors.amount}
        />
        <Input
          label="Date"
          name="date"
          type="date"
          value={values.date}
          onChange={(e) => update('date', e.target.value)}
          error={errors.date}
        />
        <Select
          label="Paid by"
          name="payer_id"
          value={values.payerId}
          onChange={(e) => update('payerId', Number(e.target.value))}
        >
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name}
              {m.user_id === currentUserId ? ' (You)' : ''}
            </option>
          ))}
        </Select>
        <Select
          label="Category"
          name="category"
          value={values.category}
          onChange={(e) => update('category', e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </Select>
      </div>

      <fieldset aria-describedby={errors.participantIds ? participantsErrorId : undefined}>
        {/* legend must be the fieldset's first child to name the group. */}
        <legend className="float-left text-sm font-medium text-gray-700">Split between</legend>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={allSelected}
              onClick={() => update('participantIds', members.map((m) => m.user_id))}
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={values.participantIds.length === 0}
              onClick={() => update('participantIds', [])}
            >
              Select none
            </Button>
          </div>
        </div>
        <div className="clear-both mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {members.map((m) => (
            <label
              key={m.user_id}
              className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-gray-800 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-emerald-600"
                checked={values.participantIds.includes(m.user_id)}
                onChange={(e) => toggleParticipant(m.user_id, e.target.checked)}
              />
              <span className="truncate" title={m.display_name}>
                {m.display_name}
              </span>
            </label>
          ))}
        </div>
        {errors.participantIds && (
          <p id={participantsErrorId} role="alert" className="mt-1 text-sm text-red-600">
            {errors.participantIds}
          </p>
        )}
      </fieldset>

      <Input
        label="Note (optional)"
        name="note"
        maxLength={NOTE_MAX}
        autoComplete="off"
        placeholder="e.g. Costco run"
        value={values.note}
        onChange={(e) => update('note', e.target.value)}
        error={errors.note}
        hint={`${values.note.length}/${NOTE_MAX}`}
      />

      <SplitPreview members={members} amount={values.amount} participantIds={values.participantIds} />

      <ErrorMessage>{serverError}</ErrorMessage>
      <p role="status" className="text-sm font-medium text-emerald-700 empty:hidden">
        {success}
      </p>

      <Button type="submit" loading={submitting} fullWidth>
        {submitting ? 'Adding…' : 'Add expense'}
      </Button>
    </form>
  )
}

/**
 * The same split the backend will compute (contract §1.3): integer cents,
 * leftover cents one each to participants in ascending user_id order.
 */
function SplitPreview({
  members,
  amount,
  participantIds,
}: {
  members: readonly GroupMember[]
  amount: string
  participantIds: readonly number[]
}) {
  const valid = validateAmount(amount) === undefined && participantIds.length > 0

  return (
    <section aria-label="Split preview" className="rounded-lg bg-gray-50 px-3 py-3 text-sm">
      <h3 className="font-medium text-gray-700">Split preview</h3>
      {valid ? (
        <SplitRows members={members} totalCents={parseCents(amount)} participantIds={participantIds} />
      ) : (
        <p className="mt-1 text-gray-500">
          {participantIds.length === 0
            ? 'Choose who shares this expense.'
            : 'Enter an amount to see each share.'}
        </p>
      )}
    </section>
  )
}

function SplitRows({
  members,
  totalCents,
  participantIds,
}: {
  members: readonly GroupMember[]
  totalCents: number
  participantIds: readonly number[]
}) {
  const shares = splitCents(totalCents, participantIds)
  const sum = shares.reduce((acc, s) => acc + s.cents, 0)
  return (
    <>
      <ul className="mt-2 space-y-1">
        {shares.map((s) => (
          <li key={s.user_id} className="flex justify-between gap-3" data-testid="preview-share">
            <span className="truncate text-gray-700">{memberName(members, s.user_id)}</span>
            <span className="shrink-0 font-mono text-gray-900">{displayMoney(s.cents)}</span>
          </li>
        ))}
      </ul>
      <p
        className="mt-2 flex justify-between gap-3 border-t border-gray-200 pt-2 font-medium text-gray-900"
        data-testid="preview-total"
      >
        <span>Shares add up to</span>
        <span className="font-mono">
          {displayMoney(sum)} {sum === totalCents ? '✓' : `≠ ${displayMoney(totalCents)}`}
        </span>
      </p>
    </>
  )
}
