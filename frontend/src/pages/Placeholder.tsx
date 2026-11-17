import type { ReactNode } from 'react'

/** Temporary page shell until the real pages are built. */
export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 text-gray-500">{children ?? 'Placeholder — not built yet.'}</p>
    </main>
  )
}
