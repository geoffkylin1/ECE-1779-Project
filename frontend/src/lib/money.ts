/**
 * Money helpers. All money math is done in integer cents — never floats.
 *
 * Wire format (see docs/api-contract.md §1.3): a decimal string, e.g. "12.34".
 * The API always returns exactly 2 decimals; it accepts "12", "12.3", "12.30".
 */

const MONEY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/

/** Largest amount the API accepts: "99999999.99". */
export const MAX_AMOUNT_CENTS = 9_999_999_999

/** True if `value` is a decimal string with at most 2 decimal places (sign allowed). */
export function isValidMoney(value: string): boolean {
  return MONEY_PATTERN.test(value.trim())
}

/**
 * Parse a decimal money string into integer cents.
 * "12.34" -> 1234, "12.3" -> 1230, "12" -> 1200, "-5.01" -> -501.
 * Throws on anything else (including more than 2 decimal places).
 */
export function parseCents(value: string): number {
  const match = MONEY_PATTERN.exec(value.trim())
  if (!match) {
    throw new Error(`Invalid money amount: "${value}"`)
  }
  const [, sign, whole, fraction = ''] = match
  // Integer arithmetic only: whole dollars * 100 + cents.
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Money amount out of range: "${value}"`)
  }
  return sign && cents !== 0 ? -cents : cents
}

/** Format integer cents as the API wire format: 1234 -> "12.34", -501 -> "-5.01". */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Cents must be a safe integer, got ${cents}`)
  }
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const remainder = abs % 100
  return `${sign}${dollars}.${String(remainder).padStart(2, '0')}`
}

/** Normalize any accepted input to exactly 2 decimals: "12.3" -> "12.30". */
export function normalizeMoney(value: string): string {
  return formatCents(parseCents(value))
}

const dollarsFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * Human-readable display: "12.34" -> "$12.34", -501 -> "-$5.01", "1500" -> "$1,500.00".
 * Accepts a wire-format string or integer cents.
 */
export function displayMoney(value: string | number): string {
  const cents = typeof value === 'string' ? parseCents(value) : value
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Cents must be a safe integer, got ${cents}`)
  }
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = dollarsFormatter.format(Math.floor(abs / 100))
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`
}

/**
 * Split `totalCents` equally among `userIds` (docs/api-contract.md §1.3).
 * Leftover cents go one each to participants in ascending user_id order.
 * Returns shares sorted by user_id; they always sum to `totalCents`.
 */
export function splitCents(
  totalCents: number,
  userIds: readonly number[],
): Array<{ user_id: number; cents: number }> {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error(`Total must be a non-negative integer number of cents, got ${totalCents}`)
  }
  if (userIds.length === 0) {
    throw new Error('Cannot split among zero participants')
  }
  const sorted = [...userIds].sort((a, b) => a - b)
  const base = Math.floor(totalCents / sorted.length)
  const leftover = totalCents - base * sorted.length
  return sorted.map((user_id, index) => ({
    user_id,
    cents: index < leftover ? base + 1 : base,
  }))
}
