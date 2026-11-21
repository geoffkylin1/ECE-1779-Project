import { apiRequest } from './client'
import type { CreatedGroup, CreateGroupRequest, GroupDetail, GroupSummary } from './types'

/** GET /api/groups — groups the caller belongs to (contract §4.3) */
export function listGroups(): Promise<GroupSummary[]> {
  return apiRequest<GroupSummary[]>('/groups')
}

/** POST /api/groups -> 201 (contract §4.3) */
export function createGroup(body: CreateGroupRequest): Promise<CreatedGroup> {
  return apiRequest<CreatedGroup>('/groups', { method: 'POST', body })
}

/** POST /api/groups/join -> 200 GroupDetail; 404 bad code, 409 already a member (contract §4.3) */
export function joinGroup(joinCode: string): Promise<GroupDetail> {
  return apiRequest<GroupDetail>('/groups/join', { method: 'POST', body: { join_code: joinCode } })
}

/** GET /api/groups/{group_id}; 404 missing, 403 not a member (contract §4.3) */
export function getGroup(groupId: number): Promise<GroupDetail> {
  return apiRequest<GroupDetail>(`/groups/${groupId}`)
}
