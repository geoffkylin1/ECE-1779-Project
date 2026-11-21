import type { ReactNode } from 'react'

/** Form- or page-level error box. Renders nothing when there is no message. */
export function ErrorMessage({ children, className = '' }: { children?: ReactNode; className?: string }) {
  if (!children) {
    return null
  }
  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`}
    >
      {children}
    </div>
  )
}
