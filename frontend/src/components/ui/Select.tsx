import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  error?: ReactNode
  hint?: ReactNode
  children: ReactNode
}

/** Labelled <select> styled like Input, with an accessible error message. */
export function Select({ label, error, hint, className = '', children, ...rest }: SelectProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'mt-1 block w-full min-w-0 truncate rounded-lg border bg-white px-3 py-2 text-base text-gray-900 shadow-sm sm:text-sm',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-200',
        ].join(' ')}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-sm text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
