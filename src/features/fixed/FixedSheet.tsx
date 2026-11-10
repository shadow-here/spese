import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AmountInput, BottomSheet, Button, Chip, Input, Select } from '../../components/ui'
import { CategoryIcon } from '../../components/CategoryIcon'
import { useToast } from '../../components/Toast'
import { db } from '../../db/db'
import { addFixedExpense, endFixedExpense, passedDueDateThisCycle, updateFixedExpense } from '../../db/fixedExpenses'
import { DEFAULT_INCOME_KIND, INCOME_KINDS } from '../../domain/income'
import type { Direction, FixedExpense } from '../../domain/types'
import type { ISODate } from '../../lib/date'
import { formatDate, ordinal } from '../../lib/format'
import { paiseToInput, parseRupees } from '../../lib/money'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export interface FixedSheetProps {
  open: boolean
  onClose: () => void
  today: ISODate
  editing?: FixedExpense
  /** For a new entry: 'out' = fixed expense (default), 'in' = recurring income. */
  direction?: Direction
}

/** Add / edit a fixed expense (FR-3.1, FR-3.5) or recurring income such as a monthly bonus. Monthly only. */
export function FixedSheet({ open, onClose, today, editing, direction = 'out' }: FixedSheetProps) {
  const incoming = (editing?.direction ?? (editing ? 'out' : direction)) === 'in'
  const title = incoming ? (editing ? 'Edit recurring income' : 'New recurring income') : editing ? 'Edit fixed expense' : 'New fixed expense'
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {open && <FixedForm key={editing?.id ?? `new-${direction}`} onClose={onClose} today={today} editing={editing} incoming={incoming} />}
    </BottomSheet>
  )
}

type Step = { kind: 'form' } | { kind: 'ask-deduct'; due: ISODate } | { kind: 'confirm-end' }

function FixedForm({ onClose, today, editing, incoming }: Omit<FixedSheetProps, 'open' | 'direction'> & { incoming: boolean }) {
  const toast = useToast()
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const [name, setName] = useState(editing?.name ?? '')
  const [amountText, setAmountText] = useState(editing ? paiseToInput(editing.amount) : '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? (incoming ? DEFAULT_INCOME_KIND : 'bills'))
  const [day, setDay] = useState(editing?.deductionDay ?? Number(today.slice(8)))
  const [errors, setErrors] = useState<{ name?: string; amount?: string; form?: string }>({})
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [saving, setSaving] = useState(false)

  function read() {
    const amount = parseRupees(amountText)
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Give it a name'
    if (amount === null || amount === 0) next.amount = 'Enter an amount'
    setErrors(next)
    return next.name || next.amount ? undefined : { name, amount: amount!, categoryId, deductionDay: day }
  }

  async function save(deductThisCycle?: boolean) {
    const input = read()
    if (!input) return
    setSaving(true)
    try {
      const label = input.name.trim()
      if (editing) {
        await updateFixedExpense(editing.id, input, today)
        toast.show(incoming ? 'Saved — applies from the next time it arrives' : 'Saved — applies from the next deduction')
      } else {
        await addFixedExpense(input, today, { deductThisCycle, direction: incoming ? 'in' : 'out' })
        toast.show(deductThisCycle ? `${label} added ${incoming ? 'to this cycle' : 'and deducted'}` : `${label} added`)
      }
      onClose()
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Could not save' })
      setSaving(false)
      setStep({ kind: 'form' })
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (step.kind === 'ask-deduct') return
    if (!read()) return
    if (!editing) {
      const due = await passedDueDateThisCycle(day, today)
      if (due) {
        setStep({ kind: 'ask-deduct', due })
        return
      }
    }
    await save()
  }

  async function end() {
    if (!editing) return
    await endFixedExpense(editing.id, today)
    toast.show(`${editing.name} ended — past ${incoming ? 'entries' : 'deductions'} are kept`)
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Input
        label="Name"
        placeholder={incoming ? 'Monthly bonus, allowance…' : 'Rent, WiFi, Gym…'}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setErrors((x) => ({ ...x, name: undefined }))
        }}
        error={errors.name}
        maxLength={60}
        autoFocus
      />
      <AmountInput
        label="Amount per month"
        value={amountText}
        onChange={(v) => {
          setAmountText(v)
          setErrors((x) => ({ ...x, amount: undefined }))
        }}
        error={errors.amount}
      />
      <Select label={incoming ? 'Arrives on' : 'Deducted on'} value={day} onChange={(e) => setDay(Number(e.target.value))} hint="Monthly">
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {ordinal(d)} of every month{d >= 29 ? ' (or the last day)' : ''}
          </option>
        ))}
      </Select>
      <fieldset>
        <legend className="mb-2 text-label text-text-secondary">{incoming ? 'Kind' : 'Category'}</legend>
        <div className="flex min-h-[72px] flex-wrap content-start gap-2">
          {(incoming ? INCOME_KINDS : (categories ?? [])).map((c) => (
            <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              <CategoryIcon icon={c.icon} />
              {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      {errors.form && (
        <p role="alert" className="text-label text-negative">
          {errors.form}
        </p>
      )}

      {step.kind === 'ask-deduct' ? (
        <div role="group" aria-label="Deduct this cycle?" className="flex flex-col gap-3 rounded-card border border-border p-3">
          <p className="text-body">
            The {ordinal(day)} has already passed this cycle. {incoming ? 'Add it' : 'Deduct it'} for {formatDate(step.due)} too?
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void save(false)} disabled={saving}>
              No, start next cycle
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => void save(true)} disabled={saving} autoFocus>
              {incoming ? 'Yes, add it' : 'Yes, deduct'}
            </Button>
          </div>
        </div>
      ) : step.kind === 'confirm-end' ? (
        <div role="group" aria-label="Confirm end" className="flex items-center gap-2">
          <p className="flex-1 text-body text-text-secondary">End it? Past {incoming ? 'entries' : 'deductions'} stay.</p>
          <Button onClick={() => setStep({ kind: 'form' })}>Cancel</Button>
          <Button variant="danger" onClick={() => void end()} autoFocus>
            End
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {editing && (
            <Button variant="danger" size="lg" onClick={() => setStep({ kind: 'confirm-end' })}>
              End
            </Button>
          )}
          <Button type="submit" variant="primary" size="lg" disabled={saving} className="flex-1">
            Save
          </Button>
        </div>
      )}
    </form>
  )
}
