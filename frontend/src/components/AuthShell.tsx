import type { ReactNode } from 'react'
import { Card } from './ui/Card'

/** Centered card layout for logged-out pages (login, register). */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-10 sm:justify-center sm:py-16">
      <p className="mb-6 text-2xl font-bold tracking-tight text-emerald-700">SplitMate</p>
      <main className="w-full max-w-sm">
        <Card>
          <h1 className="mb-5 text-xl font-semibold text-gray-900">{title}</h1>
          {children}
        </Card>
      </main>
    </div>
  )
}
