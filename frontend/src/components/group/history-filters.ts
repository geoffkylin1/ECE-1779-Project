import type { Category } from '../../api/types'

/** History filters. Empty string = no filter. Dates are "YYYY-MM-DD", inclusive. */
export interface HistoryFilters {
  from: string
  to: string
  category: Category | ''
}

export const EMPTY_FILTERS: HistoryFilters = { from: '', to: '', category: '' }
