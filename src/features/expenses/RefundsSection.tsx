import { useId, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import { AmountInput, Button, Input } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { db } from '../../db/db'
import { addRefund, deleteRefund, refundsOf, updateRefund } from '../../db/refunds'
import { allowedDateRange, restoreTransaction } from '../../db/transactions'
import type { Transaction } from '../../domain/types'
import { maxDate, type ISODate } from '../../lib/date'
import { formatDate } from '../../lib/format'
import { formatPaise, paiseToInput, parseRupees } from '../../lib/money'

/**
 * Refunds on an expense (v1.1 Phase 2): "paid ₹1,800, got ₹600 back". Lives in the expense's
 * edit sheet — refunds are never shown as their own rows anywhere else.
 */
export function RefundsSection({ expense, today }: { expense: Transaction; today: ISODate }) {
  const toast = useToast()
  const refunds = useLiveQuery(() => refundsOf(expense.id), [expense.id])
  // Live copy of the expense, so amounts stay right after edits.
  const live = useLiveQuery(() => db.transactions.get(expense.id), [expense.id]) ?? expense
  const [editing, setEditing] = useState<Transaction | 'new'>()

  if (!refunds) return null
  const total = refunds.reduce((s, r) => s + r.amount, 0)
  const sameCycle = refunds.filter((r) => r.cycleId === live.cycleId).reduce((s, r) => s + r.amount, 0)
  const left = live.amount - total

  async function remove(r: Transaction) {
    const removed = await deleteRefund(r.id)
    if (removed) toast.show('Refund removed', { action: { label: 'Undo', onAction: () => void restoreTransaction(removed) } })
  }

  return (
    <section aria-labelledby="refunds-heading" className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <h3 id="refunds-heading" className="text-label text-text-secondary">
          Refunds
        </h3>
        {total > 0 && (
          <p className="text-label text-text-secondary">
            <span className="tnum text-positive">{formatPaise(total, { decimals: 'auto' })}</span> back · counts as{' '}
            <span className="tnum text-text-primary">{formatPaise(live.amount - sameCycle, { decimals: 'auto' })}</span>
          </p>
        )}
      </div>

      {refunds.length > 0 && (
        <ul className="overflow-hidden rounded-card border border-border">
          {refunds.map((r) =>
            editing !== 'new' && editing?.id === r.id ? (
              <li key={r.id} className="border-b border-border p-3 last:border-b-0">
                <RefundForm expense={live} today={today} refund={r} maxAmount={left + r.amount} onDone={() => setEditing(undefined)} />
              </li>
            ) : (
              <li key={r.id} className="flex min-h-10 items-center border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-left transition-quick hover:bg-surface-hover"
                >
                  <span className="tnum text-body text-positive">{formatPaise(r.amount, { decimals: 'auto' })}</span>
                  <span className="min-w-0 flex-1 truncate text-label text-text-secondary">
                    {formatDate(r.date)}
                    {r.note ? ` · ${r.note}` : ''}
                    {r.cycleId !== live.cycleId ? ' · added to that cycle’s balance' : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(r)}
                  aria-label={`Remove refund of ${formatPaise(r.amount)}`}
                  className="flex size-10 items-center justify-center text-text-secondary transition-quick hover:text-text-primary"
                >
                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {editing === 'new' ? (
        <RefundForm expense={live} today={today} maxAmount={left} onDone={() => setEditing(undefined)} />
      ) : (
        left > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setEditing('new')} className="self-start">
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Add refund
          </Button>
        )
      )}
    </section>
  )
}

function RefundForm({
  expense,
  today,
  refund,
  maxAmount,
  onDone,
}: {
  expense: Transaction
  today: ISODate
  refund?: Transaction
  maxAmount: number
  onDone: () => void
}) {
  const range = useLiveQuery(() => allowedDateRange(today), [today])
  const [amountText, setAmountText] = useState(refund ? paiseToInput(refund.amount) : '')
  const [date, setDate] = useState<ISODate>(refund?.date ?? today)
  const [note, setNote] = useState(refund?.note ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const dateId = useId()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseRupees(amountText)
    if (!amount) return setError('Enter the amount you got back')
    setSaving(true)
    try {
      if (refund) await updateRefund(refund.id, { amount, date, note }, today)
      else await addRefund(expense.id, { amount, date, note }, today)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the refund')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label={refund ? 'Edit refund' : 'Add refund'} className="flex flex-col gap-3 rounded-card border border-border p-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <AmountInput
            label="Amount back"
            value={amountText}
            onChange={(v) => (setAmountText(v), setError(undefined))}
            error={error}
            placeholder={paiseToInput(Math.max(0, maxAmount))}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={dateId} className="text-label text-text-secondary">
            Date
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            min={range ? maxDate(range.min, expense.date) : expense.date}
            max={range?.max}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="tnum h-9 rounded-control border border-border bg-surface px-2 text-body text-text-primary [color-scheme:dark] focus-visible:border-accent focus-visible:outline-none"
          />
        </div>
      </div>
      <Input aria-label="Refund note" placeholder="From whom? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {refund ? 'Save refund' : 'Add refund'}
        </Button>
      </div>
    </form>
  )
}
