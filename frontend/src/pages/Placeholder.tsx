import type { ReactNode } from 'react'
import { Card } from '../components/ui/Card'

/** Temporary page body (rendered inside Layout) until the real pages are built. */
export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">{title}</h1>
      <Card>
        <p className="text-gray-500">{children ?? 'Placeholder — not built yet.'}</p>
      </Card>
    </section>
  )
}
