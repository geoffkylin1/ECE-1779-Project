import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useApi } from './useApi'

/** A promise you resolve/reject from the test. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useApi', () => {
  it('goes loading -> data', async () => {
    const { result } = renderHook(() => useApi(() => Promise.resolve(42), []))
    expect(result.current).toMatchObject({ loading: true, data: undefined, error: null })
    await waitFor(() => expect(result.current).toMatchObject({ loading: false, data: 42, error: null }))
  })

  it('exposes errors and recovers on refetch', async () => {
    const fetcher = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useApi(fetcher, []))

    await waitFor(() => expect(result.current.error).toEqual(new Error('boom')))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.data).toBe('ok'))
    expect(result.current.error).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('keeps data visible during a refetch', async () => {
    const second = deferred<string>()
    const fetcher = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useApi(fetcher, []))
    await waitFor(() => expect(result.current.data).toBe('first'))

    act(() => result.current.refetch())
    expect(result.current).toMatchObject({ loading: true, data: 'first' })

    await act(async () => second.resolve('second'))
    expect(result.current).toMatchObject({ loading: false, data: 'second' })
  })

  it('drops stale data when deps change and ignores out-of-order responses', async () => {
    const slow = deferred<string>()
    const fetchers: Record<number, () => Promise<string>> = {
      1: () => slow.promise,
      2: () => Promise.resolve('group 2'),
    }
    const { result, rerender } = renderHook(({ id }) => useApi(fetchers[id], [id]), {
      initialProps: { id: 1 },
    })

    rerender({ id: 2 })
    await waitFor(() => expect(result.current.data).toBe('group 2'))

    // The response for id=1 arrives late and must not overwrite id=2.
    await act(async () => slow.resolve('group 1'))
    expect(result.current.data).toBe('group 2')
  })
})
