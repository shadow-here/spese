import { useCallback, useEffect, useState } from 'react'
import { startup } from '../db/startup'
import type { ISODate } from '../lib/date'
import { requestPersistentStorage } from '../lib/platform'

export type BootState =
  | { status: 'loading' }
  | { status: 'needs-onboarding' }
  | { status: 'ready'; cycleId: string }
  | { status: 'error'; message: string }

/**
 * Runs startup() (roll cycles forward + back-fill auto-deductions) on open and again
 * whenever the date changes. Returns `rerun` for after onboarding.
 */
export function useStartup(today: ISODate): [BootState, () => void] {
  const [state, setState] = useState<BootState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    startup(today)
      .then((result) => {
        if (cancelled) return
        setState(result.status === 'ready' ? { status: 'ready', cycleId: result.cycle.id } : result)
        // Data lives only here: ask the browser not to evict it under storage pressure.
        if (result.status === 'ready') void requestPersistentStorage().catch(() => undefined)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error(err)
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [today, nonce])

  const rerun = useCallback(() => setNonce((n) => n + 1), [])
  return [state, rerun]
}
