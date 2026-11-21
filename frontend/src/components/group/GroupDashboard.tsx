import { useEffect, useRef, useState } from 'react'
import { getBalances } from '../../api/balances'
import { listExpenses } from '../../api/expenses'
import { listSettlements } from '../../api/settlements'
import type { GroupDetail } from '../../api/types'
import { useAuth } from '../../auth/useAuth'
import { useApi } from '../../hooks/useApi'
import type { SettlementDraft } from '../../lib/balances'
import { AddExpenseForm } from './AddExpenseForm'
import { BalancesCard } from './BalancesCard'
import { Disclosure } from './Disclosure'
import { HistoryCard } from './HistoryCard'
import { EMPTY_FILTERS, type HistoryFilters } from './history-filters'
import { SettlementForm } from './SettlementForm'

/**
 * Everything below the group header: balances and forms on the left,
 * history on the right (one column on phones). Only rendered for members,
 * so none of these requests run after a 403/404.
 */
export function GroupDashboard({ group }: { group: GroupDetail }) {
  const { user } = useAuth()
  const currentUserId = user?.id
  const groupId = group.id

  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS)
  const balances = useApi(() => getBalances(groupId), [groupId])
  const expenses = useApi(
    () =>
      listExpenses(groupId, {
        from: filters.from || undefined,
        to: filters.to || undefined,
        category: filters.category || undefined,
      }),
    [groupId, filters.from, filters.to, filters.category],
  )
  // No server-side filter for settlements: HistoryCard filters dates locally.
  const settlements = useApi(() => listSettlements(groupId), [groupId])

  const [expenseOpen, setExpenseOpen] = useState(false)
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [draft, setDraft] = useState<SettlementDraft | null>(null)
  // Bumped on every "Settle up" click so the form remounts with the new prefill.
  const [settleUpCount, setSettleUpCount] = useState(0)
  const settlementSectionRef = useRef<HTMLElement>(null)
  const settlementAmountRef = useRef<HTMLInputElement>(null)

  function handleSettleUp(next: SettlementDraft) {
    setDraft(next)
    setSettlementOpen(true)
    setSettleUpCount((n) => n + 1)
  }

  // After "Settle up": bring the form into view and focus the amount.
  useEffect(() => {
    if (settleUpCount === 0) return
    settlementSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    settlementAmountRef.current?.focus({ preventScroll: true })
  }, [settleUpCount])

  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <BalancesCard
          balances={balances.data}
          loading={balances.loading}
          error={balances.error}
          onRetry={balances.refetch}
          currentUserId={currentUserId}
          onSettleUp={handleSettleUp}
        />

        <Disclosure label="+ Add expense" open={expenseOpen} onToggle={() => setExpenseOpen((o) => !o)}>
          <AddExpenseForm
            groupId={groupId}
            members={group.members}
            currentUserId={currentUserId}
            onCreated={() => {
              balances.refetch()
              expenses.refetch()
            }}
          />
        </Disclosure>

        <Disclosure
          label="+ Record settlement"
          open={settlementOpen}
          sectionRef={settlementSectionRef}
          onToggle={() => {
            setDraft(null)
            setSettlementOpen((o) => !o)
          }}
        >
          <SettlementForm
            key={settleUpCount}
            groupId={groupId}
            members={group.members}
            currentUserId={currentUserId}
            draft={draft}
            amountRef={settlementAmountRef}
            onCreated={() => {
              balances.refetch()
              settlements.refetch()
            }}
          />
        </Disclosure>
      </div>

      <div className="min-w-0">
        <HistoryCard
          members={group.members}
          filters={filters}
          onFiltersChange={setFilters}
          expenses={expenses}
          settlements={settlements}
        />
      </div>
    </div>
  )
}
