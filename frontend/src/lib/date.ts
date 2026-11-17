/** Date helpers. API dates are "YYYY-MM-DD" with no time zone (contract §1.4). */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Today in the user's local time zone, as "YYYY-MM-DD" (not UTC). */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const displayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "2026-11-15" -> "Nov 15, 2026". Parsed as a local date so it never shifts a day. */
export function displayDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return value
  return displayFormatter.format(new Date(y, m - 1, d))
}
