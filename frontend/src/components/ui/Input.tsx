import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  /** Field error, shown under the input with role="alert". */
  error?: ReactNode
  /** Helper text shown under the input when there is no error. */
  hint?: ReactNode
}

/** Labelled text input with an accessible error message. */
export function Input({ label, error, hint, className = '', ...rest }: InputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-base text-gray-900 shadow-sm sm:text-sm',
          'placeholder:text-gray-400 focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-200',
        ].join(' ')}
        {...rest}
      />
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
