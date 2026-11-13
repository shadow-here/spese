import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { AppLock } from '../domain/types'
import { isStandalone } from '../lib/platform'
import { clearSystemUi, isSystemUiExpected } from '../lib/systemUi'

export interface AppLockState {
  /** undefined while loading; null when the lock is off. */
  lock: AppLock | null | undefined
  locked: boolean
  /** True while the app is leaving / in the background (and "Hide in app switcher" is on): covers the screen. */
  shielded: boolean
  unlock: () => void
}

/**
 * App lock behaviour (PRD #27; changed 13 Nov 2026 to lock instantly): locked on every fresh
 * open, and again every time you leave Spese — switching apps, locking the phone, going home.
 * Not for system screens Spese opened itself (lib/systemUi.ts). Turning the lock on in
 * Settings doesn't lock you out on the spot.
 */
export function useAppLock(): AppLockState {
  const user = useLiveQuery(() => db.users.get('me'), [])
  const lock = user === undefined ? undefined : (user.lock ?? null)
  const [locked, setLocked] = useState<boolean | undefined>(undefined)
  const [shielded, setShielded] = useState(false)
  const leftForSystemUi = useRef(false)
  const wasHidden = useRef(false)

  // Decide once, when the lock setting first loads: on a fresh open, locked if it's on.
  useEffect(() => {
    if (lock !== undefined && locked === undefined) setLocked(lock !== null)
  }, [lock, locked])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden.current = true
        leftForSystemUi.current = isSystemUiExpected()
        setShielded(true)
      } else {
        setShielded(false)
        if (lock && wasHidden.current && !leftForSystemUi.current) setLocked(true)
        if (leftForSystemUi.current) clearSystemUi() // used up
        wasHidden.current = false
        leftForSystemUi.current = false
      }
    }
    // The app switcher snapshots the screen the moment you swipe up — often before
    // "visibilitychange" arrives. Losing focus comes earlier, so cover on that too. Only on
    // phones / the installed app: on a desktop, clicking another window shouldn't blank Spese.
    const earlyCover = isStandalone() || window.matchMedia?.('(pointer: coarse)').matches
    const onBlur = () => earlyCover && !isSystemUiExpected() && setShielded(true)
    const onFocus = () => document.visibilityState === 'visible' && setShielded(false)
    const onPageHide = () => setShielded(true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onFocus)
    }
  }, [lock])

  // "Hide in app switcher" is on unless turned off — and always on with the app lock.
  const hideInSwitcher = Boolean(lock) || user?.hideInSwitcher !== false
  const unlock = useCallback(() => setLocked(false), [])
  return { lock, locked: lock ? (locked ?? true) : false, shielded: hideInSwitcher && shielded, unlock }
}
