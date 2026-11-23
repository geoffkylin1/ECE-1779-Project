import type { Balance } from '../../api/types'
import { settleUpDraft, type SettlementDraft } from '../../lib/balances'
import { errorMessage } from '../../lib/errors'
import { displayMoney, parseCents } from '../../lib/money'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ErrorMessage } from '../ui/ErrorMessage'
import { Spinner } from '../ui/Spinner'
import { YouBadge } from './YouBadge'

interface BalancesCardProps {
  balances: Balance[] | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  currentUserId: number | undefined
  onSettleUp: (draft: SettlementDraft) => void
}

/** GET /balances: who gets back money, who owes, who is settled up. */
export function BalancesCard({
  balances,
  loading,
  error,
  onRetry,
  currentUserId,
  onSettleUp,
}: BalancesCardProps) {
  return (
    <Card title="Balances">
      {balances ? (
        <ul className="-mx-2 space-y-1" aria-label="Balances">
          {balances.map((b) => (
            <BalanceRow
              key={b.user_id}
              balance={b}
              isYou={b.user_id === currentUserId}
              draft={settleUpDraft(balances, b.user_id)}
              onSettleUp={onSettleUp}
            />
          ))}
        </ul>
      ) : loading ? (
        <Spinner label="Loading balances…" showLabel className="text-gray-500" />
      ) : (
        <div className="space-y-3">
          <ErrorMessage>Could not load balances: {errorMessage(error)}</ErrorMessage>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </Card>
  )
}

function BalanceRow({
  balance,
  isYou,
  draft,
  onSettleUp,
}: {
  balance: Balance
  isYou: boolean
  draft: SettlementDraft | null
  onSettleUp: (draft: SettlementDraft) => void
}) {
  const cents = parseCents(balance.net)
  const amount = displayMoney(Math.abs(cents))
  const status =
    cents > 0
      ? { text: `gets back ${amount}`, className: 'text-emerald-700' }
      : cents < 0
        ? { text: `owes ${amount}`, className: 'text-red-600' }
        : { text: 'settled up', className: 'text-gray-500' }

  return (
    <li
      data-testid={`balance-${balance.user_id}`}
      aria-current={isYou ? 'true' : undefined}
      className={`flex items-center gap-3 rounded-lg px-2 py-2 ${isYou ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 font-medium text-gray-900">
          <span className="truncate" title={balance.display_name}>
            {balance.display_name}
          </span>
          {isYou && <YouBadge />}
        </p>
        <p className={`text-sm font-medium ${status.className}`} data-testid="balance-status">
          {status.text}
        </p>
      </div>
      {draft && (
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          aria-label={`Settle up for ${balance.display_name}`}
          onClick={() => onSettleUp(draft)}
        >
          Settle up
        </Button>
      )}
    </li>
  )
}
