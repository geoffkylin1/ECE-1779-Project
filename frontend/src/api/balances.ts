import { apiRequest } from './client'
import type { Balance } from './types'

/**
 * GET /api/groups/{group_id}/balances (contract §4.5)
 * Every member, sorted by user_id. net > 0 = receives, net < 0 = owes.
 */
export function getBalances(groupId: number): Promise<Balance[]> {
  return apiRequest<Balance[]>(`/groups/${groupId}/balances`)
}
