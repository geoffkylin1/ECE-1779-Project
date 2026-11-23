import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  children: ReactNode
}

export function Card({ title, children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
      {...rest}
    >
      {title && <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>}
      {children}
    </div>
  )
}
