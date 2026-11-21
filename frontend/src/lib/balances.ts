import type { Balance, GroupMember } from '../api/types'
import { formatCents, parseCents } from './money'

export interface SettlementDraft {
  fromUserId: number
  toUserId: number
  /** Wire-format amount, e.g. "469.67". */
  amount: string
}

/**
 * Prefill for "Settle up": the debtor pays the member with the largest
 * positive balance, the smaller of the two absolute amounts.
 * Returns null if `fromUserId` does not owe anything or nobody is owed.
 */
export function settleUpDraft(balances: readonly Balance[], fromUserId: number): SettlementDraft | null {
  const debtor = balances.find((b) => b.user_id === fromUserId)
  if (!debtor) return null
  const owes = -parseCents(debtor.net)
  if (owes <= 0) return null

  let creditor: Balance | undefined
  let best = 0
  for (const b of balances) {
    const cents = parseCents(b.net)
    // Strictly greater: ties go to the lowest user_id (balances are sorted by id).
    if (cents > best) {
      best = cents
      creditor = b
    }
  }
  if (!creditor) return null

  return { fromUserId, toUserId: creditor.user_id, amount: formatCents(Math.min(owes, best)) }
}

/** Display name for a user id. Never shows a raw id in the UI. */
export function memberName(members: readonly GroupMember[], userId: number): string {
  return members.find((m) => m.user_id === userId)?.display_name ?? 'Unknown member'
}
