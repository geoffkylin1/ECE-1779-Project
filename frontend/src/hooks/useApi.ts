import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

export interface ApiState<T> {
  /** Last successful result. Kept during a refetch; cleared when `deps` change. */
  data: T | undefined
  /** Error from the last attempt (usually an ApiError), or null. */
  error: unknown
  /** True while a request is in flight (including refetches). */
  loading: boolean
  /** Run the request again, keeping the current data visible meanwhile. */
  refetch: () => void
}

/**
 * Minimal data-fetching hook: runs `fetcher` on mount and whenever `deps`
 * change, tracks loading/error/data, and ignores responses that arrive after
 * a newer request started (or after unmount).
 *
 * @example
 * const { data, error, loading, refetch } = useApi(() => getGroup(id), [id])
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: DependencyList): ApiState<T> {
  const [state, setState] = useState<Omit<ApiState<T>, 'refetch'>>({
    data: undefined,
    error: null,
    loading: true,
  })
  const [reloadKey, setReloadKey] = useState(0)

  // Always call the latest fetcher without making it an effect dependency.
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  // Distinguishes refetch() (keep data) from a deps change (drop stale data).
  const keepDataRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const keepData = keepDataRef.current
    keepDataRef.current = false

    setState((s) => ({ data: keepData ? s.data : undefined, error: null, loading: true }))
    fetcherRef.current().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false })
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ data: s.data, error, loading: false }))
      },
    )
    return () => {
      cancelled = true
    }
    // `deps` is the caller's dependency list, like useEffect's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  const refetch = useCallback(() => {
    keepDataRef.current = true
    setReloadKey((k) => k + 1)
  }, [])

  return { ...state, refetch }
}
