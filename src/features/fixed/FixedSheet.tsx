import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AmountInput, BottomSheet, Button, Chip, Input, Select } from '../../components/ui'
import { CategoryIcon } from '../../components/CategoryIcon'
import { useToast } from '../../components/Toast'
import { db } from '../../db/db'
import { addFixedExpense, endFixedExpense, passedDueDateThisCycle, updateFixedExpense } from '../../db/fixedExpenses'
import type { FixedExpense } from '../../domain/types'
import type { ISODate } from '../../lib/date'
import { formatDate, ordinal } from '../../lib/format'
import { paiseToInput, parseRupees } from '../../lib/money'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export interface FixedSheetProps {
  open: boolean
  onClose: () => void
  today: ISODate
  editing?: FixedExpense
}

/** Add / edit a fixed expense (FR-3.1, FR-3.5). Monthly only in P0. */
export function FixedSheet({ open, onClose, today, editing }: FixedSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Edit fixed expense' : 'New fixed expense'}>
      {open && <FixedForm key={editing?.id ?? 'new'} onClose={onClose} today={today} editing={editing} />}
    </BottomSheet>
  )
}

type Step = { kind: 'form' } | { kind: 'ask-deduct'; due: ISODate } | { kind: 'confirm-end' }

function FixedForm({ onClose, today, editing }: Omit<FixedSheetProps, 'open'>) {
  const toast = useToast()
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const [name, setName] = useState(editing?.name ?? '')
  const [amountText, setAmountText] = useState(editing ? paiseToInput(editing.amount) : '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? 'bills')
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
      if (editing) {
        await updateFixedExpense(editing.id, input, today)
        toast.show('Saved — applies from the next deduction')
      } else {
        await addFixedExpense(input, today, { deductThisCycle })
        toast.show(deductThisCycle ? `${input.name.trim()} added and deducted` : `${input.name.trim()} added`)
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
    toast.show(`${editing.name} ended — past deductions are kept`)
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Input
        label="Name"
        placeholder="Rent, WiFi, Gym…"
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
      <Select label="Deducted on" value={day} onChange={(e) => setDay(Number(e.target.value))} hint="Monthly">
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {ordinal(d)} of every month{d >= 29 ? ' (or the last day)' : ''}
          </option>
        ))}
      </Select>
      <fieldset>
        <legend className="mb-2 text-label text-text-secondary">Category</legend>
        <div className="flex min-h-[72px] flex-wrap content-start gap-2">
          {categories?.map((c) => (
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
            The {ordinal(day)} has already passed this cycle. Deduct it for {formatDate(step.due)} too?
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void save(false)} disabled={saving}>
              No, start next cycle
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => void save(true)} disabled={saving} autoFocus>
              Yes, deduct
            </Button>
          </div>
        </div>
      ) : step.kind === 'confirm-end' ? (
        <div role="group" aria-label="Confirm end" className="flex items-center gap-2">
          <p className="flex-1 text-body text-text-secondary">End it? Past deductions stay.</p>
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
