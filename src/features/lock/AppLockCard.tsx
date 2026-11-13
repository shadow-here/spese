import { useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useToast } from '../../components/Toast'
import { Button, Card, Input, Switch } from '../../components/ui'
import { db } from '../../db/db'
import { changePin, disableLock, enableLock, setBiometric } from '../../db/lock'
import { biometricAvailable, registerBiometric } from '../../lib/biometric'
import { isValidPin, PIN_MAX, PIN_MIN } from '../../lib/pin'

type Mode = 'idle' | 'enable' | 'change' | 'disable'

/** Settings → App lock (PRD #27): PIN, optional Face ID / fingerprint, change PIN, turn off. */
export function AppLockCard() {
  const toast = useToast()
  const user = useLiveQuery(() => db.users.get('me'), [])
  const [mode, setMode] = useState<Mode>('idle')
  const [canBio, setCanBio] = useState(false)
  useEffect(() => {
    void biometricAvailable().then(setCanBio)
  }, [])
  if (!user) return null
  const lock = user.lock

  async function toggleBio(on: boolean) {
    try {
      if (on) {
        await setBiometric(await registerBiometric())
        toast.show('Face ID / fingerprint turned on')
      } else {
        await setBiometric(undefined)
        toast.show('Face ID / fingerprint turned off')
      }
    } catch (err) {
      toast.show(err instanceof Error && /cancel|NotAllowed/i.test(err.message + err.name) ? 'Cancelled' : 'Couldn’t set up Face ID / fingerprint')
    }
  }

  return (
    <Card title="App lock">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-body text-text-secondary">
          {lock
            ? 'On — Spese locks the moment you leave it, and asks for your PIN when you’re back.'
            : 'Lock Spese the moment you leave it, and ask for a PIN to get back in.'}{' '}
          <span className="text-label">It hides the app; the data on this phone isn’t encrypted.</span>
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-body">Hide in app switcher</span>
            <span className="text-label text-text-secondary">
              {lock ? 'Always on while the app lock is on.' : 'Covers your numbers when you leave Spese.'}
            </span>
          </span>
          <Switch
            checked={Boolean(lock) || user.hideInSwitcher !== false}
            onChange={(on) => void (lock ? undefined : db.users.update('me', { hideInSwitcher: on }))}
            label="Hide Spese's screen in the app switcher"
            disabled={Boolean(lock)}
          />
        </div>

        {lock && canBio && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-body">Face ID / fingerprint</span>
            <Switch checked={Boolean(lock.credentialId)} onChange={(on) => void toggleBio(on)} label="Unlock with Face ID or fingerprint" />
          </div>
        )}

        {mode === 'idle' &&
          (lock ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setMode('change')}>Change PIN</Button>
              <Button variant="danger" onClick={() => setMode('disable')}>
                Turn off
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={() => setMode('enable')} className="self-start">
              Turn on app lock
            </Button>
          ))}

        {mode === 'enable' && (
          <PinForm
            fields={['new', 'confirm']}
            submitLabel="Turn on"
            onCancel={() => setMode('idle')}
            onSubmit={async ({ next }) => {
              await enableLock(next)
              setMode('idle')
              toast.show(canBio ? 'App lock on — you can add Face ID / fingerprint below' : 'App lock on')
              return undefined
            }}
          />
        )}
        {mode === 'change' && (
          <PinForm
            fields={['current', 'new', 'confirm']}
            submitLabel="Change PIN"
            onCancel={() => setMode('idle')}
            onSubmit={async ({ current, next }) => {
              if (!(await changePin(current, next))) return 'Current PIN is wrong'
              setMode('idle')
              toast.show('PIN changed')
              return undefined
            }}
          />
        )}
        {mode === 'disable' && (
          <PinForm
            fields={['current']}
            submitLabel="Turn off app lock"
            danger
            onCancel={() => setMode('idle')}
            onSubmit={async ({ current }) => {
              if (!(await disableLock(current))) return 'Wrong PIN'
              setMode('idle')
              toast.show('App lock off')
              return undefined
            }}
          />
        )}
      </div>
    </Card>
  )
}

type Field = 'current' | 'new' | 'confirm'
const LABELS: Record<Field, string> = { current: 'Current PIN', new: `New PIN (${PIN_MIN}–${PIN_MAX} digits)`, confirm: 'Repeat new PIN' }

function PinForm({
  fields,
  submitLabel,
  danger,
  onCancel,
  onSubmit,
}: {
  fields: Field[]
  submitLabel: string
  danger?: boolean
  onCancel: () => void
  /** Returns an error message, or undefined on success. */
  onSubmit: (v: { current: string; next: string }) => Promise<string | undefined>
}) {
  const [values, setValues] = useState<Record<Field, string>>({ current: '', new: '', confirm: '' })
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (fields.includes('new')) {
      if (!isValidPin(values.new)) return setError(`Use ${PIN_MIN}–${PIN_MAX} digits`)
      if (values.new !== values.confirm) return setError('The two PINs don’t match')
    }
    setBusy(true)
    const message = await onSubmit({ current: values.current, next: values.new })
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-border p-3" aria-label={submitLabel}>
      {fields.map((f, i) => (
        <Input
          key={f}
          label={LABELS[f]}
          type="password"
          inputMode="numeric"
          autoComplete={f === 'current' ? 'current-password' : 'new-password'}
          maxLength={PIN_MAX}
          value={values[f]}
          onChange={(e) => {
            setValues((v) => ({ ...v, [f]: e.target.value.replace(/\D/g, '') }))
            setError(undefined)
          }}
          autoFocus={i === 0}
          className="tnum tracking-[0.3em]"
        />
      ))}
      {error && (
        <p role="alert" className="text-label text-negative">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
