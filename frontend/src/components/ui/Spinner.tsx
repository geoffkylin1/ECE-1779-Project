interface SpinnerProps {
  /** Accessible label; also shown visually when `showLabel` is set. */
  label?: string
  showLabel?: boolean
  /** Purely visual (e.g. inside a busy button): no role, hidden from screen readers. */
  decorative?: boolean
  className?: string
}

export function Spinner({
  label = 'Loading',
  showLabel = false,
  decorative = false,
  className = '',
}: SpinnerProps) {
  const icon = (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )

  if (decorative) {
    return <span className={`inline-flex ${className}`}>{icon}</span>
  }

  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      {icon}
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  )
}
