import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { useToast } from '../components/Toast'
import { AmountInput, Button, Card, Select } from '../components/ui'
import { deleteAllData } from '../db/backup'
import { moveCategory } from '../db/categories'
import { changePayDay, MAX_SHIFT_DAYS, shiftCurrentCycleStart } from '../db/cycleSettings'
import { confirmSalary } from '../db/cycles'
import { db } from '../db/db'
import { nextPayDateAfter } from '../domain/cycle'
import type { Category, PayCycle } from '../domain/types'
import { CategorySheet } from '../features/categories/CategorySheet'
import { RestoreFromFile } from '../features/backup/RestoreFromFile'
import { useExportBackup } from '../features/backup/useBackup'
import { addDays, maxDate, minDate, todayISO, type ISODate } from '../lib/date'
import { formatDate, formatRange, ordinal } from '../lib/format'
import { paiseToInput, parseRupees } from '../lib/money'
import { requestPersistentStorage, useInstall } from '../lib/platform'

/** Settings (Key screen 5): salary, pay date, categories, backup/restore, install, delete all (FR-6.1/6.2). */
export function SettingsPage({ today }: { today: ISODate }) {
  const user = useLiveQuery(() => db.users.get('me'), [])
  const cycles = useLiveQuery(() => db.cycles.orderBy('start').reverse().limit(2).toArray(), [])
  if (!user || !cycles?.[0]) return null
  const [current, previous] = cycles as [PayCycle, PayCycle | undefined]

  return (
    <div className="flex flex-col gap-4">
      <Card title="Salary & pay cycle">
        <div className="flex flex-col divide-y divide-border">
          <Row>
            <p className="text-label text-text-secondary">
              Current cycle <span className="text-text-primary">{formatRange(current.start, current.end)}</span>
            </p>
          </Row>
          <Row>
            <SalaryForm key={`${current.id}-${current.salary}`} cycle={current} />
          </Row>
          <Row>
            <PayDayForm key={user.payDay} payDay={user.payDay} cycle={current} today={today} />
          </Row>
          <Row>
            <ShiftStartForm key={current.start} cycle={current} previous={previous} today={today} />
          </Row>
        </div>
      </Card>

      <CategoriesCard />
      <BackupCard lastBackupAt={user.lastBackupAt} />
      <InstallCard />
      <DangerCard />
      <p className="px-1 text-center text-label text-text-secondary">No account, no server — your data never leaves this device unless you export it.</p>
    </div>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="p-4">{children}</div>
}

function SalaryForm({ cycle }: { cycle: PayCycle }) {
  const toast = useToast()
  const [text, setText] = useState(paiseToInput(cycle.salary))
  const [error, setError] = useState<string>()
  const changed = parseRupees(text) !== cycle.salary

  async function submit(e: FormEvent) {
    e.preventDefault()
    const salary = parseRupees(text)
    if (!salary) return setError('Enter your salary')
    await confirmSalary(cycle.id, salary)
    toast.show('Salary updated for this and future cycles')
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <div className="flex-1">
        <AmountInput label="Salary (in-hand)" value={text} onChange={(v) => (setText(v), setError(undefined))} error={error} />
      </div>
      <Button type="submit" disabled={!changed} className="h-9">
        Save
      </Button>
    </form>
  )
}

function PayDayForm({ payDay, cycle, today }: { payDay: number; cycle: PayCycle; today: ISODate }) {
  const toast = useToast()
  const [day, setDay] = useState(payDay)
  const [confirming, setConfirming] = useState(false)

  // Same rule as changePayDay(): preview what happens to the current cycle.
  const nextStart = nextPayDateAfter(addDays(today, -1), day)
  const newEnd = nextStart > cycle.start ? addDays(nextStart, -1) : addDays(nextPayDateAfter(cycle.start, day), -1)

  async function apply() {
    await changePayDay(day, todayISO())
    setConfirming(false)
    toast.show(`Pay day changed to the ${ordinal(day)}`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select label="Salary arrives on" value={day} onChange={(e) => (setDay(Number(e.target.value)), setConfirming(false))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {ordinal(d)} of every month{d >= 29 ? ' (or the last day)' : ''}
              </option>
            ))}
          </Select>
        </div>
        <Button disabled={day === payDay || confirming} onClick={() => setConfirming(true)} className="h-9">
          Change
        </Button>
      </div>
      {confirming && (
        <div role="group" aria-label="Confirm pay day change" className="flex flex-col gap-2 rounded-card border border-border p-3">
          <p className="text-body">
            This cycle will {newEnd < cycle.end ? 'end early' : 'run'} until <span className="tnum">{formatDate(newEnd, true)}</span>; the next one
            starts on the {ordinal(day)}.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void apply()} autoFocus>
              Change pay day
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ShiftStartForm({ cycle, previous, today }: { cycle: PayCycle; previous?: PayCycle; today: ISODate }) {
  const toast = useToast()
  const id = useId()
  const [date, setDate] = useState(cycle.start)
  const [error, setError] = useState<string>()
  const min = maxDate(addDays(cycle.start, -MAX_SHIFT_DAYS), previous ? addDays(previous.start, 1) : addDays(cycle.start, -MAX_SHIFT_DAYS))
  const max = minDate(minDate(addDays(cycle.start, MAX_SHIFT_DAYS), today), cycle.end)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await shiftCurrentCycleStart(date, todayISO())
      toast.show(`This cycle now starts ${formatDate(date)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move the start')
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-text-secondary">
        Salary came early or late this month? Move this cycle’s start
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="date"
          value={date}
          min={min}
          max={max}
          onChange={(e) => (e.target.value && setDate(e.target.value), setError(undefined))}
          className="tnum h-9 flex-1 rounded-control border border-border bg-surface px-3 text-body text-text-primary [color-scheme:dark] focus-visible:border-accent focus-visible:outline-none"
        />
        <Button type="submit" disabled={date === cycle.start} className="h-9">
          Move
        </Button>
      </div>
      {error && <p className="text-label text-negative">{error}</p>}
    </form>
  )
}

/** Manage categories (v1.1 Phase 3): tap to edit or remove, arrows to reorder, Add for a new one. */
function CategoriesCard() {
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const [sheet, setSheet] = useState<{ open: boolean; editing?: Category }>({ open: false })
  const last = (categories?.length ?? 0) - 1
  return (
    <Card
      title="Categories"
      action={
        <Button variant="ghost" size="sm" onClick={() => setSheet({ open: true })} aria-label="Add category">
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          Add
        </Button>
      }
    >
      <ul>
        {categories?.map((c, i) => (
          <li key={c.id} className="flex min-h-10 items-center border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setSheet({ open: true, editing: c })}
              className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left transition-quick hover:bg-surface-hover"
            >
              <CategoryIcon icon={c.icon} className="shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 truncate text-body">{c.name}</span>
              <span aria-hidden="true" className="mr-2 size-2 shrink-0 rounded-[2px]" style={{ background: c.colour }} />
            </button>
            <div className="flex pr-2">
              <IconButton label={`Move ${c.name} up`} disabled={i === 0} onClick={() => void moveCategory(c.id, -1)}>
                <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
              </IconButton>
              <IconButton label={`Move ${c.name} down`} disabled={i === last} onClick={() => void moveCategory(c.id, 1)}>
                <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <CategorySheet open={sheet.open} editing={sheet.editing} onClose={() => setSheet({ open: false })} />
    </Card>
  )
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-control text-text-secondary transition-quick hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function BackupCard({ lastBackupAt }: { lastBackupAt?: number }) {
  const exportBackup = useExportBackup()
  const last = lastBackupAt ? new Date(lastBackupAt) : undefined
  return (
    <Card title="Backup">
      <div className="flex flex-col gap-3 p-4">
        <p className="text-body text-text-secondary">
          {last ? (
            <>
              Last backup <span className="text-text-primary">{formatDate(todayISO(last), true)}</span>
            </>
          ) : (
            'No backup yet.'
          )}{' '}
          Deleting the app from your home screen deletes its data — keep a backup file somewhere safe.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void exportBackup()}>
            Export backup
          </Button>
          {/* Reload so startup re-runs on the restored data. */}
          <RestoreFromFile replacing onRestored={() => window.location.reload()} />
        </div>
      </div>
    </Card>
  )
}

function InstallCard() {
  const { state, install } = useInstall()
  const [persisted, setPersisted] = useState<boolean>()
  useEffect(() => {
    void requestPersistentStorage().then(setPersisted)
  }, [])
  return (
    <Card title="App">
      <div className="flex flex-col gap-2 p-4 text-body text-text-secondary">
        {state === 'installed' && <p>Installed on this device. Works offline.</p>}
        {state === 'prompt' && (
          <div className="flex items-center justify-between gap-3">
            <p>Install for one-tap access and offline use.</p>
            <Button variant="primary" onClick={() => void install()}>
              Install
            </Button>
          </div>
        )}
        {state === 'ios' && <p>To install: tap Share, then “Add to Home Screen”.</p>}
        {state === 'unavailable' && <p>Open in Chrome or Safari and use “Add to Home Screen” to install. Works offline once loaded.</p>}
        {persisted !== undefined && (
          <p className="text-label">
            Storage: {persisted ? 'protected from automatic clean-up' : 'may be cleared by the browser if space runs low — keep backups'}
          </p>
        )}
      </div>
    </Card>
  )
}

function DangerCard() {
  const [confirming, setConfirming] = useState(false)
  async function wipe() {
    await deleteAllData()
    window.location.hash = ''
    window.location.reload()
  }
  return (
    <Card title="Danger zone">
      <div className="flex flex-col gap-3 p-4">
        {confirming ? (
          <div role="group" aria-label="Confirm delete all" className="flex flex-col gap-2">
            <p className="text-body">Delete all salary, cycles, expenses and fixed costs from this device? This can’t be undone.</p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => void wipe()} autoFocus>
                Delete everything
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-body text-text-secondary">Delete all data and start over.</p>
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Delete all data
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
