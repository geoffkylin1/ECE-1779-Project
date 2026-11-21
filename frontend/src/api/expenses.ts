import { apiRequest } from './client'
import type { CreateExpenseRequest, Expense, ExpenseFilters } from './types'

/**
 * GET /api/groups/{group_id}/expenses?from=&to=&category= (contract §4.4)
 * Newest first. from/to are inclusive.
 */
export function listExpenses(groupId: number, filters: ExpenseFilters = {}): Promise<Expense[]> {
  return apiRequest<Expense[]>(`/groups/${groupId}/expenses`, {
    query: { from: filters.from, to: filters.to, category: filters.category },
  })
}

/** POST /api/groups/{group_id}/expenses -> 201 Expense (contract §4.4) */
export function createExpense(groupId: number, body: CreateExpenseRequest): Promise<Expense> {
  return apiRequest<Expense>(`/groups/${groupId}/expenses`, { method: 'POST', body })
}
