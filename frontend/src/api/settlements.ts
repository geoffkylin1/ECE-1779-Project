import { apiRequest } from './client'
import type { CreateSettlementRequest, Settlement } from './types'

/** GET /api/groups/{group_id}/settlements — newest first (contract §4.6) */
export function listSettlements(groupId: number): Promise<Settlement[]> {
  return apiRequest<Settlement[]>(`/groups/${groupId}/settlements`)
}

/** POST /api/groups/{group_id}/settlements -> 201 Settlement (contract §4.6) */
export function createSettlement(
  groupId: number,
  body: CreateSettlementRequest,
): Promise<Settlement> {
  return apiRequest<Settlement>(`/groups/${groupId}/settlements`, { method: 'POST', body })
}
