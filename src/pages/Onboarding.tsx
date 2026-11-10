import { useId, useState, type FormEvent } from 'react'
import { ChevronDown, Plus, Repeat, ShieldCheck, Wallet } from 'lucide-react'
import { RestoreFromFile } from '../features/backup/RestoreFromFile'
import type { FixedExpense } from '../domain/types'
import { FixedList, useFixedListData } from '../features/fixed/FixedList'
import { FixedSheet } from '../features/fixed/FixedSheet'
import { AmountInput, Button } from '../components/ui'
import { onboard } from '../db/cycles'
import { cycleContaining } from '../domain/cycle'
import type { ISODate } from '../lib/date'
import { formatRange, ordinal } from '../lib/format'
import { parseRupees } from '../lib/money'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

/**
 * First run only (no data on the device): welcome → 1) salary + pay date (FR-1.1)
 * → 2) optional fixed costs. Once set up, the app always opens straight to the dashboard.
 */
export function OnboardingPage({ today, onDone }: { today: ISODate; onDone: () => void }) {
  const [stage, setStage] = useState<'welcome' | 'salary' | 'fixed'>('welcome')
  if (stage === 'welcome') return <WelcomeStep onStart={() => setStage('salary')} onRestored={onDone} />
  return stage === 'salary' ? (
    <SalaryStep today={today} onDone={() => setStage('fixed')} />
  ) : (
    <FixedStep today={today} onDone={onDone} />
  )
}

const POINTS = [
  { icon: Wallet, text: 'Starts from your salary, so you always know what’s left to spend' },
  { icon: Repeat, text: 'Rent, WiFi and subscriptions deduct themselves on their due day' },
  { icon: ShieldCheck, text: 'No account, no server — your data stays on this phone' },
]

function WelcomeStep({ onStart, onRestored }: { onStart: () => void; onRestored: () => void }) {
  return (
    <main className="flex min-h-full items-start justify-center px-4 pt-[max(15vh,env(safe-area-inset-top))] pb-8">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-balance">Spese</h1>
          <p className="text-body text-text-secondary">How much can I still spend this pay cycle?</p>
        </header>
        <ul className="flex flex-col gap-4">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-body">
              <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-text-secondary" />
              {text}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={onStart} className="w-full" autoFocus>
            Get started
          </Button>
          <RestoreFromFile label="Restore from backup" size="lg" replacing={false} onRestored={onRestored} />
        </div>
      </div>
    </main>
  )
}

function FixedStep({ today, onDone }: { today: ISODate; onDone: () => void }) {
  const data = useFixedListData()
  const [sheet, setSheet] = useState<{ open: boolean; editing?: FixedExpense }>({ open: false })
  const count = data?.fixed.length ?? 0
  return (
    <main className="flex min-h-full items-start justify-center px-4 pt-[max(15vh,env(safe-area-inset-top))] pb-8">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-label text-text-secondary">Step 2 of 2</p>
          <h1 className="text-title">Add fixed costs</h1>
          <p className="text-body text-text-secondary">
            Rent, WiFi, gym, subscriptions — they’ll deduct themselves on their due day. You can add more later.
          </p>
        </header>
        {data && count > 0 && (
          <FixedList data={data} today={today} onEdit={(fe) => setSheet({ open: true, editing: fe })} showEnded={false} />
        )}
        <Button size="lg" onClick={() => setSheet({ open: true })} className="w-full">
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          Add fixed cost
        </Button>
        <Button variant={count > 0 ? 'primary' : 'ghost'} size="lg" onClick={onDone} className="w-full">
          {count > 0 ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
      <FixedSheet open={sheet.open} editing={sheet.editing} today={today} onClose={() => setSheet({ open: false })} />
    </main>
  )
}

function SalaryStep({ today, onDone }: { today: ISODate; onDone: () => void }) {
  const [salaryText, setSalaryText] = useState('')
  const [payDay, setPayDay] = useState(1)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const payDayId = useId()

  const preview = cycleContaining(today, payDay)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const salary = parseRupees(salaryText)
    if (salary === null || salary === 0) {
      setError('Enter your monthly in-hand salary')
      return
    }
    setSaving(true)
    try {
      await onboard({ salary, payDay, today })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-full items-start justify-center px-4 pt-[max(15vh,env(safe-area-inset-top))] pb-8">
      <form onSubmit={submit} noValidate className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-label text-text-secondary">Step 1 of 2</p>
          <h1 className="text-title">Set up your pay cycle</h1>
          <p className="text-body text-text-secondary">
            We'll track how much you can still spend until your next salary.
          </p>
        </header>

        <AmountInput
          label="Net monthly salary (in-hand)"
          size="lg"
          value={salaryText}
          onChange={(v) => {
            setSalaryText(v)
            setError(undefined)
          }}
          error={error}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor={payDayId} className="text-label text-text-secondary">
            Salary arrives on
          </label>
          <div className="relative">
            <select
              id={payDayId}
              value={payDay}
              onChange={(e) => setPayDay(Number(e.target.value))}
              className="h-9 w-full appearance-none rounded-control border border-border bg-surface pr-9 pl-3 text-body text-text-primary transition-quick hover:border-text-tertiary focus-visible:border-accent focus-visible:outline-none"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {ordinal(d)} of every month{d >= 29 ? ' (or the last day)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary"
            />
          </div>
          <p className="text-label text-text-secondary">
            Current cycle: <span className="text-text-primary">{formatRange(preview.start, preview.end)}</span>
          </p>
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={saving} className="w-full">
          Start tracking
        </Button>
        <p className="text-center text-label text-text-secondary">Everything stays on this device.</p>
      </form>
    </main>
  )
}
