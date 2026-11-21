import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CATEGORIES, type Category, type Expense, type GroupMember, type Settlement } from '../../api/types'
import { memberName } from '../../lib/balances'
import { displayDate } from '../../lib/date'
import { errorMessage } from '../../lib/errors'
import { categoryLabel } from '../../lib/format'
import { displayMoney } from '../../lib/money'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ErrorMessage } from '../ui/ErrorMessage'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Spinner } from '../ui/Spinner'
import { EMPTY_FILTERS, type HistoryFilters } from './history-filters'


export const NO_EXPENSES_MESSAGE = 'No expenses yet — add the first one with “+ Add expense”.'
export const NO_MATCHING_EXPENSES_MESSAGE = 'No expenses match these filters'
export const NO_SETTLEMENTS_MESSAGE = 'No settlements yet.'
export const NO_MATCHING_SETTLEMENTS_MESSAGE = 'No settlements match these dates'

interface Remote<T> {
  data: T | undefined
  loading: boolean
  error: unknown
  refetch: () => void
}

interface HistoryCardProps {
  members: readonly GroupMember[]
  filters: HistoryFilters
  onFiltersChange: (filters: HistoryFilters) => void
  expenses: Remote<Expense[]>
  settlements: Remote<Settlement[]>
}

type Tab = 'expenses' | 'settlements'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'settlements', label: 'Settlements' },
]

/** History with Expenses / Settlements tabs and shared date filters. */
export function HistoryCard({ members, filters, onFiltersChange, expenses, settlements }: HistoryCardProps) {
  const [tab, setTab] = useState<Tab>('expenses')
  const baseId = useId()
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ expenses: null, settlements: null })

  const hasDateFilter = filters.from !== '' || filters.to !== ''
  const hasFilter = hasDateFilter || filters.category !== ''

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const next: Tab = tab === 'expenses' ? 'settlements' : 'expenses'
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <Card title="History" className="min-w-0">
      <div role="tablist" aria-label="History" className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${baseId}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={handleTabKey}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-emerald-600 ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Input
          label="From date"
          type="date"
          value={filters.from}
          onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })}
        />
        <Input
          label="To date"
          type="date"
          value={filters.to}
          onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })}
        />
        {tab === 'expenses' && (
          <Select
            label="Category"
            className="col-span-2 sm:col-span-1"
            value={filters.category}
            onChange={(e) => onFiltersChange({ ...filters, category: e.target.value as Category | '' })}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </Select>
        )}
        <div className={`flex items-end ${tab === 'expenses' ? 'col-span-2 sm:col-span-1' : 'col-span-2'}`}>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasFilter}
            onClick={() => onFiltersChange(EMPTY_FILTERS)}
          >
            Clear filters
          </Button>
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${tab}`}
        aria-labelledby={`${baseId}-tab-${tab}`}
        tabIndex={0}
        className="focus-visible:outline-2 focus-visible:outline-emerald-600"
      >
        {tab === 'expenses' ? (
          <RemoteList
            remote={expenses}
            what="expenses"
            empty={hasFilter ? NO_MATCHING_EXPENSES_MESSAGE : NO_EXPENSES_MESSAGE}
            render={(list) => list.map((e) => <ExpenseRow key={e.id} expense={e} members={members} />)}
          />
        ) : (
          <RemoteList
            remote={{
              ...settlements,
              data: settlements.data && filterByDate(settlements.data, filters),
            }}
            what="settlements"
            empty={hasDateFilter ? NO_MATCHING_SETTLEMENTS_MESSAGE : NO_SETTLEMENTS_MESSAGE}
            render={(list) => list.map((s) => <SettlementRow key={s.id} settlement={s} members={members} />)}
          />
        )}
      </div>
    </Card>
  )
}

/** Inclusive from/to, like GET /expenses (dates compare correctly as strings). */
function filterByDate<T extends { date: string }>(items: T[], { from, to }: HistoryFilters): T[] {
  return items.filter((i) => (from === '' || i.date >= from) && (to === '' || i.date <= to))
}

function RemoteList<T>({
  remote,
  what,
  empty,
  render,
}: {
  remote: Remote<T[]>
  what: string
  empty: string
  render: (items: T[]) => ReactNode
}) {
  if (remote.data) {
    if (remote.data.length === 0) {
      return <p className="py-6 text-center text-gray-500">{empty}</p>
    }
    return (
      <ul className="divide-y divide-gray-100" aria-label={what} aria-busy={remote.loading || undefined}>
        {render(remote.data)}
      </ul>
    )
  }
  if (remote.loading) {
    return <Spinner label={`Loading ${what}…`} showLabel className="text-gray-500" />
  }
  return (
    <div className="space-y-3">
      <ErrorMessage>
        Could not load {what}: {errorMessage(remote.error)}
      </ErrorMessage>
      <Button variant="secondary" size="sm" onClick={remote.refetch}>
        Retry
      </Button>
    </div>
  )
}

function ExpenseRow({ expense, members }: { expense: Expense; members: readonly GroupMember[] }) {
  const payer = memberName(members, expense.payer_id)
  return (
    <li className="py-3 first:pt-0 last:pb-0" data-testid="expense-row">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {categoryLabel(expense.category)}
            </span>
            <span className="truncate font-medium text-gray-900" title={expense.note ?? undefined}>
              {expense.note ?? <span className="font-normal text-gray-400 italic">No note</span>}
            </span>
          </p>
          <p className="mt-0.5 truncate text-sm text-gray-500">
            {displayDate(expense.date)} · <span title={payer}>Paid by {payer}</span>
          </p>
        </div>
        <p className="shrink-0 font-mono font-semibold text-gray-900">{displayMoney(expense.amount)}</p>
      </div>
      <details className="group mt-1 text-sm">
        <summary className="cursor-pointer rounded text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
          Shares ({expense.shares.length})
        </summary>
        <ul className="mt-1 space-y-0.5 pl-4">
          {expense.shares.map((s) => (
            <li key={s.user_id} className="flex justify-between gap-3 text-gray-700">
              <span className="truncate">{memberName(members, s.user_id)}</span>
              <span className="shrink-0 font-mono">{displayMoney(s.amount)}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

function SettlementRow({ settlement, members }: { settlement: Settlement; members: readonly GroupMember[] }) {
  const from = memberName(members, settlement.from_user_id)
  const to = memberName(members, settlement.to_user_id)
  return (
    <li className="py-3 first:pt-0 last:pb-0" data-testid="settlement-row">
      <p className="flex items-start justify-between gap-3 font-medium text-gray-900">
        <span className="min-w-0 truncate" title={`${from} paid ${to}`}>
          {from} paid {to}
        </span>{' '}
        <span className="shrink-0 font-mono font-semibold">{displayMoney(settlement.amount)}</span>
      </p>
      <p className="mt-0.5 truncate text-sm text-gray-500" title={settlement.note ?? undefined}>
        {displayDate(settlement.date)}
        {settlement.note && ` · ${settlement.note}`}
      </p>
    </li>
  )
}
