import { useState, type FormEvent, type Ref } from 'react'
import { createSettlement } from '../../api/settlements'
import type { GroupMember } from '../../api/types'
import { memberName, type SettlementDraft } from '../../lib/balances'
import { todayLocal } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import { displayMoney, normalizeMoney } from '../../lib/money'
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
  fromUserId: number
  toUserId: number
  amount: string
  date: string
  note: string
}

export const SAME_PERSON_MESSAGE = 'Choose two different people'

function initialValues(
  members: readonly GroupMember[],
  currentUserId: number | undefined,
  draft: SettlementDraft | null,
): Values {
  const base = { date: todayLocal(), note: '' }
  if (draft) {
    return { ...base, fromUserId: draft.fromUserId, toUserId: draft.toUserId, amount: draft.amount }
  }
  const from = members.find((m) => m.user_id === currentUserId) ?? members[0]
  const to = members.find((m) => m.user_id !== from?.user_id)
  return { ...base, fromUserId: from?.user_id ?? 0, toUserId: to?.user_id ?? 0, amount: '' }
}

function validate(values: Values): FieldErrors<Values> {
  const errors: FieldErrors<Values> = {}
  if (values.fromUserId === values.toUserId) errors.toUserId = SAME_PERSON_MESSAGE
  const amount = validateAmount(values.amount)
  if (amount) errors.amount = amount
  if (!values.date) errors.date = 'Date is required'
  const note = validateNote(values.note)
  if (note) errors.note = note
  return errors
}

interface SettlementFormProps {
  groupId: number
  members: readonly GroupMember[]
  currentUserId: number | undefined
  /** Prefill from "Settle up". Remount (change `key`) to apply a new one. */
  draft: SettlementDraft | null
  onCreated: () => void
  amountRef?: Ref<HTMLInputElement>
}

/** POST /settlements: record that one member paid another. */
export function SettlementForm({
  groupId,
  members,
  currentUserId,
  draft,
  onCreated,
  amountRef,
}: SettlementFormProps) {
  const [values, setValues] = useState(() => initialValues(members, currentUserId, draft))
  const [errors, setErrors] = useState<FieldErrors<Values>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    // Changing either person can fix "same person".
    const clear = key === 'fromUserId' || key === 'toUserId' ? { toUserId: undefined } : {}
    setErrors((e) => ({ ...e, [key]: undefined, ...clear }))
    setServerError(null)
    setSuccess(null)
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
      const s = await createSettlement(groupId, {
        from_user_id: values.fromUserId,
        to_user_id: values.toUserId,
        amount: normalizeMoney(values.amount),
        date: values.date,
        note: normalizeNote(values.note),
      })
      setValues(initialValues(members, currentUserId, null))
      setSuccess(
        `Recorded: ${memberName(members, s.from_user_id)} paid ${memberName(members, s.to_user_id)} ${displayMoney(s.amount)}.`,
      )
      onCreated()
    } catch (err) {
      setServerError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const memberOptions = members.map((m) => (
    <option key={m.user_id} value={m.user_id}>
      {m.display_name}
      {m.user_id === currentUserId ? ' (You)' : ''}
    </option>
  ))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Record settlement">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="From (who paid)"
          name="from_user_id"
          value={values.fromUserId}
          onChange={(e) => update('fromUserId', Number(e.target.value))}
        >
          {memberOptions}
        </Select>
        <Select
          label="To (who received)"
          name="to_user_id"
          value={values.toUserId}
          onChange={(e) => update('toUserId', Number(e.target.value))}
          error={errors.toUserId}
        >
          {memberOptions}
        </Select>
        <Input
          ref={amountRef}
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
      </div>
      <Input
        label="Note (optional)"
        name="note"
        maxLength={NOTE_MAX}
        autoComplete="off"
        placeholder="e.g. e-transfer"
        value={values.note}
        onChange={(e) => update('note', e.target.value)}
        error={errors.note}
        hint={`${values.note.length}/${NOTE_MAX}`}
      />

      <ErrorMessage>{serverError}</ErrorMessage>
      <p role="status" className="text-sm font-medium text-emerald-700 empty:hidden">
        {success}
      </p>

      <Button type="submit" loading={submitting} fullWidth>
        {submitting ? 'Recording…' : 'Record settlement'}
      </Button>
    </form>
  )
}
