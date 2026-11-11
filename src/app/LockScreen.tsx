import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete, Fingerprint, Lock } from 'lucide-react'
import { Button } from '../components/ui'
import { deleteAllData } from '../db/backup'
import { checkPin } from '../db/lock'
import type { AppLock } from '../domain/types'
import { verifyBiometric } from '../lib/biometric'
import { cn } from '../lib/cn'

const MAX_TRIES = 5
const COOLDOWN_S = 30

/**
 * Full-screen lock (PRD #27). Nothing behind it is rendered while locked. PIN keypad (or type
 * digits on a keyboard), plus Face ID / fingerprint when it's set up. Five wrong PINs pause
 * entry for 30 seconds. Forgot the PIN? The only way out is to reset this device's data and
 * restore a backup — backups never contain the lock.
 */
export function LockScreen({ lock, onUnlock }: { lock: AppLock; onUnlock: () => void }) {
  const [pin, setPinState] = useState('')
  // The ref is the source of truth: digits can arrive faster than React re-renders (fast typing,
  // quick taps), and each press must build on the previous one, not on a stale render.
  const pinRef = useRef('')
  const setPin = useCallback((next: string) => {
    pinRef.current = next
    setPinState(next)
  }, [])
  const [error, setError] = useState<string>()
  const [checking, setChecking] = useState(false)
  const checkingRef = useRef(false)
  const [fails, setFails] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const [forgot, setForgot] = useState(false)
  const triedBiometric = useRef(false)

  const tryBiometric = useCallback(async () => {
    if (!lock.credentialId) return
    if (await verifyBiometric(lock.credentialId)) onUnlock()
  }, [lock.credentialId, onUnlock])

  // Offer Face ID straight away once (some browsers need a tap instead — the button stays).
  useEffect(() => {
    if (lock.credentialId && !triedBiometric.current) {
      triedBiometric.current = true
      void tryBiometric()
    }
  }, [lock.credentialId, tryBiometric])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  const submit = useCallback(
    async (candidate: string) => {
      checkingRef.current = true
      setChecking(true)
      const ok = await checkPin(candidate)
      checkingRef.current = false
      setChecking(false)
      if (ok) return onUnlock()
      const n = fails + 1
      setFails(n)
      setPin('')
      if (n % MAX_TRIES === 0) {
        setCooldown(COOLDOWN_S)
        setError(`Too many tries — wait ${COOLDOWN_S} seconds`)
      } else setError('Wrong PIN')
    },
    [fails, onUnlock, setPin],
  )

  const press = useCallback(
    (digit: string) => {
      if (checkingRef.current || cooldown > 0 || pinRef.current.length >= lock.pinLength) return
      setError(undefined)
      const next = pinRef.current + digit
      setPin(next)
      // Submitted here, not inside a state updater (React may run those twice).
      if (next.length === lock.pinLength) void submit(next)
    },
    [cooldown, lock.pinLength, submit, setPin],
  )
  const back = useCallback(() => setPin(pinRef.current.slice(0, -1)), [setPin])

  // Keyboard: digits and Backspace (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [press, back])

  async function reset() {
    await deleteAllData()
    window.location.hash = ''
    window.location.reload()
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  return (
    <main
      role="dialog"
      aria-modal="true"
      aria-label="Spese is locked"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-8 bg-bg px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex flex-col items-center gap-2">
        <Lock size={20} strokeWidth={1.5} aria-hidden="true" className="text-text-secondary" />
        <h1 className="text-title">Spese</h1>
        <p className="text-body text-text-secondary">{cooldown > 0 ? `Try again in ${cooldown}s` : 'Enter your PIN'}</p>
      </div>

      <div className="flex gap-3" aria-label={`${pin.length} of ${lock.pinLength} digits entered`} role="status">
        {Array.from({ length: lock.pinLength }, (_, i) => (
          <span key={i} aria-hidden="true" className={cn('size-3 rounded-full border border-text-secondary', i < pin.length && 'border-text-primary bg-text-primary')} />
        ))}
      </div>
      <p role="alert" className="h-4 text-label text-negative">
        {error}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <Key key={k} label={k} onClick={() => press(k)} disabled={cooldown > 0 || checking} />
        ))}
        {lock.credentialId ? (
          <button
            type="button"
            onClick={() => void tryBiometric()}
            aria-label="Unlock with Face ID or fingerprint"
            className="flex size-16 items-center justify-center rounded-full text-text-secondary transition-quick hover:bg-surface-hover hover:text-text-primary"
          >
            <Fingerprint size={24} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : (
          <span />
        )}
        <Key label="0" onClick={() => press('0')} disabled={cooldown > 0 || checking} />
        <button
          type="button"
          onClick={back}
          aria-label="Delete last digit"
          className="flex size-16 items-center justify-center rounded-full text-text-secondary transition-quick hover:bg-surface-hover hover:text-text-primary"
        >
          <Delete size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {forgot ? (
        <div role="group" aria-label="Forgot PIN" className="flex max-w-sm flex-col gap-2 rounded-card border border-border p-3 text-center">
          <p className="text-body">
            The PIN can’t be recovered. You can reset Spese on this device — this <strong>deletes all its data</strong> — then restore a backup
            (backups don’t include the lock).
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => setForgot(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void reset()}>
              Reset this device
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setForgot(true)} className="text-label text-text-secondary underline-offset-2 hover:underline">
          Forgot PIN?
        </button>
      )}
    </main>
  )
}

function Key({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tnum flex size-16 items-center justify-center rounded-full border border-border bg-surface text-title transition-quick hover:bg-surface-hover active:scale-95 disabled:opacity-40"
    >
      {label}
    </button>
  )
}

/** Covers the app while it's in the background, so the app switcher shows no numbers. */
export function PrivacyShield() {
  return (
    <div aria-hidden="true" className="fixed inset-0 z-[79] flex items-center justify-center bg-bg">
      <Lock size={20} strokeWidth={1.5} className="text-text-secondary" />
    </div>
  )
}
