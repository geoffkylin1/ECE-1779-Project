import { useEffect, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { Button } from './ui/Button'

type CopyStatus = 'idle' | 'copied' | 'failed'

/** A group's join code in large monospace with a Copy button. */
export function JoinCode({ code, size = 'md' }: { code: string; size?: 'md' | 'lg' }) {
  const [status, setStatus] = useState<CopyStatus>('idle')

  // Reset "Copied!" after a moment.
  useEffect(() => {
    if (status !== 'copied') return
    const timer = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [status])

  async function handleCopy() {
    setStatus((await copyText(code)) ? 'copied' : 'failed')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <code
          data-testid="join-code"
          className={`rounded-lg bg-gray-100 px-3 py-1.5 font-mono font-semibold tracking-[0.2em] text-gray-900 select-all ${
            size === 'lg' ? 'text-2xl' : 'text-lg'
          }`}
        >
          {code}
        </code>
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {status === 'copied' ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      {/* Announced to screen readers when the status changes. */}
      <p role="status" className="mt-1 min-h-5 text-sm text-gray-500">
        {status === 'copied' && 'Copied to clipboard.'}
        {status === 'failed' && 'Could not copy — select the code and copy it manually.'}
      </p>
    </div>
  )
}
