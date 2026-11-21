import { useId, type ReactNode, type Ref } from 'react'

interface DisclosureProps {
  /** Button text, e.g. "+ Add expense". */
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  sectionRef?: Ref<HTMLElement>
}

/** Card whose body is shown/hidden by a button in its header (keeps the phone layout short). */
export function Disclosure({ label, open, onToggle, children, sectionRef }: DisclosureProps) {
  const bodyId = useId()
  return (
    <section ref={sectionRef} className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left text-base font-semibold text-emerald-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-emerald-600 sm:px-6"
        >
          {label}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="currentColor"
          >
            <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z" />
          </svg>
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="border-t border-gray-100 px-5 pt-4 pb-5 sm:px-6">
          {children}
        </div>
      )}
    </section>
  )
}
