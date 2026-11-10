import { useEffect, useId, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AmountInput, BottomSheet, Button, Chip, Input } from '../../components/ui'
import { CategoryIcon } from '../../components/CategoryIcon'
import { useToast } from '../../components/Toast'
import { db } from '../../db/db'
import {
  addExpense,
  allowedDateRange,
  deleteTransaction,
  lastUsedCategoryId,
  restoreTransaction,
  updateTransaction,
} from '../../db/transactions'
import { FALLBACK_CATEGORY_ID } from '../../domain/categories'
import type { Transaction } from '../../domain/types'
import type { ISODate } from '../../lib/date'
import { paiseToInput, parseRupees } from '../../lib/money'

export interface ExpenseSheetProps {
  open: boolean
  onClose: () => void
  today: ISODate
  /** Edit this transaction; omit to add a new expense. */
  editing?: Transaction
}

/**
 * Add / edit expense (FR-2.1, features 3–5). Amount is focused on open, the last-used
 * category and today's date are pre-filled, and Enter saves — a 5-second log.
 */
export function ExpenseSheet({ open, onClose, today, editing }: ExpenseSheetProps) {
  const isAuto = editing?.type === 'auto'
  const title = editing ? (isAuto ? 'Edit auto-deduction' : 'Edit expense') : 'New expense'
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {/* Keyed so each open starts from fresh state. */}
      {open && <ExpenseForm key={editing?.id ?? 'new'} onClose={onClose} today={today} editing={editing} />}
    </BottomSheet>
  )
}

function ExpenseForm({ onClose, today, editing }: Omit<ExpenseSheetProps, 'open'>) {
  const toast = useToast()
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), [])
  const range = useLiveQuery(() => allowedDateRange(today), [today])
  const [amountText, setAmountText] = useState(editing ? paiseToInput(editing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | undefined>(editing?.categoryId)
  const [date, setDate] = useState<ISODate>(editing?.date ?? today)
  const [note, setNote] = useState(editing?.note ?? '')
  const [amountError, setAmountError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const dateId = useId()
  const isAuto = editing?.type === 'auto'

  // Feature 4: pre-select the last-used category for a new expense.
  useEffect(() => {
    if (editing) return
    let cancelled = false
    void lastUsedCategoryId().then((id) => {
      if (!cancelled) setCategoryId((current) => current ?? id ?? 'food')
    })
    return () => {
      cancelled = true
    }
  }, [editing])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseRupees(amountText)
    if (amount === null || amount === 0) {
      setAmountError('Enter an amount')
      return
    }
    setSaving(true)
    try {
      const input = { amount, categoryId: categoryId ?? FALLBACK_CATEGORY_ID, date, note }
      if (editing) {
        await updateTransaction(editing.id, input, today)
        toast.show('Saved')
      } else {
        await addExpense(input, today)
        toast.show('Expense added', { durationMs: 2000 })
      }
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save')
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    const removed = await deleteTransaction(editing.id)
    onClose()
    if (removed) {
      toast.show(isAuto ? 'Skipped for this cycle' : 'Expense deleted', {
        action: { label: 'Undo', onAction: () => void restoreTransaction(removed) },
      })
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <AmountInput
        label="Amount"
        hideLabel
        size="lg"
        value={amountText}
        onChange={(v) => {
          setAmountText(v)
          setAmountError(undefined)
        }}
        error={amountError}
        autoFocus
      />

      <fieldset>
        <legend className="mb-2 text-label text-text-secondary">Category</legend>
        {/* min-height reserves two rows so the sheet doesn't jump when categories load */}
        <div className="flex min-h-[72px] flex-wrap content-start gap-2">
          {categories?.map((c) => (
            <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              <CategoryIcon icon={c.icon} />
              {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3 border-y border-border py-2">
        <label htmlFor={dateId} className="text-body text-text-secondary">
          Date
        </label>
        <div className="flex items-center gap-2">
          {date !== today && (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="h-7 rounded-control px-2 text-label text-text-secondary transition-quick hover:bg-surface-hover hover:text-text-primary"
            >
              Today
            </button>
          )}
          <input
            id={dateId}
            type="date"
            value={date}
            min={range?.min}
            max={range?.max}
            required
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="tnum h-8 rounded-control border border-border bg-surface px-2 text-body text-text-primary [color-scheme:dark] focus-visible:border-accent focus-visible:outline-none"
          />
        </div>
      </div>

      <Input aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />

      {formError && (
        <p role="alert" className="text-label text-negative">
          {formError}
        </p>
      )}

      {confirmingDelete ? (
        <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
          <p className="flex-1 text-body text-text-secondary">{isAuto ? 'Skip this deduction for this cycle?' : 'Delete this expense?'}</p>
          <Button onClick={() => setConfirmingDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => void remove()} autoFocus>
            {isAuto ? 'Skip' : 'Delete'}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          {editing && (
            <Button variant="danger" size="lg" onClick={() => setConfirmingDelete(true)}>
              {isAuto ? 'Skip this cycle' : 'Delete'}
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
