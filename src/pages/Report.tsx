import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '../components/ui'
import { db } from '../db/db'
import { summarizeCycle } from '../domain/balance'
import { budgetRows } from '../domain/budgets'
import { incomeKind } from '../domain/income'
import { paymentMethodName } from '../domain/payment'
import { netAmount, refundsByExpense } from '../domain/refunds'
import { minDate, type ISODate } from '../lib/date'
import { formatDate, formatRange } from '../lib/format'
import { formatPaise } from '../lib/money'
import { allowSystemUi } from '../lib/systemUi'

const money = (p: number) => formatPaise(p, { decimals: 'auto' })
/** Money out, with a minus — but plain "₹0" when there's nothing (no "−₹0"). */
const out = (p: number) => (p > 0 ? `−${money(p)}` : money(p))

/**
 * One-cycle summary laid out for paper (PRD #26 "PDF"): "Save as PDF" opens the browser's print
 * dialog, where every platform (including iPhone) offers Save as PDF. Print styles turn the
 * page light and hide the app chrome (index.css @media print).
 */
export function ReportPage({ cycleId, today, onBack }: { cycleId?: string; today: ISODate; onBack: () => void }) {
  const data = useLiveQuery(async () => {
    const cycle = cycleId ? await db.cycles.get(cycleId) : await db.cycles.where('status').equals('open').last()
    if (!cycle) return null
    const [transactions, fixedExpenses, categories, allRefunds] = await Promise.all([
      db.transactions.where('cycleId').equals(cycle.id).toArray(),
      db.fixedExpenses.toArray(),
      db.categories.orderBy('order').toArray(),
      db.transactions.where('type').equals('refund').toArray(),
    ])
    return { cycle, transactions, fixedExpenses, categories, allRefunds }
  }, [cycleId])

  const summary = useMemo(() => (data ? summarizeCycle({ ...data, today: minDate(today, data.cycle.end) }) : undefined), [data, today])
  if (data === null) return <p className="text-body text-text-secondary">That pay cycle no longer exists.</p>
  if (!data || !summary) return null

  const { cycle, categories, transactions } = data
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const refunds = refundsByExpense(data.allRefunds, new Map(transactions.map((t) => [t.id, t])))
  const rows = transactions
    .filter((t) => !t.skipped && t.type !== 'refund')
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
  const budgets = budgetRows(summary, categories)
  const finished = cycle.end < today

  return (
    <article className="report flex flex-col gap-6">
      <div className="flex gap-2 print:hidden">
        <Button onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            allowSystemUi() // the print sheet isn't "leaving Spese"
            window.print()
          }}
        >
          <Printer size={16} strokeWidth={1.5} aria-hidden="true" />
          Save as PDF
        </Button>
      </div>

      <header>
        <p className="text-label text-text-secondary">Spese · pay cycle report</p>
        <h2 className="text-title">{formatRange(cycle.start, cycle.end)} {cycle.end.slice(0, 4)}</h2>
        <p className="text-label text-text-secondary">
          {finished ? 'Finished cycle' : `As of ${formatDate(minDate(today, cycle.end), true)} · ${summary.daysLeft} days left`}
        </p>
      </header>

      <section aria-labelledby="r-summary">
        <h3 id="r-summary" className="mb-2 text-label font-medium text-text-secondary">
          Summary
        </h3>
        <table className="tnum w-full text-body">
          <tbody>
            <Row label="Salary" value={money(summary.salary)} />
            {summary.otherIncome > 0 && <Row label="Other income" value={`+${money(summary.otherIncome)}`} />}
            <Row label="Fixed costs" value={out(summary.fixedDeducted)} />
            <Row label="Spent" value={out(summary.variableSpent)} />
            <Row label={finished ? 'Saved' : 'Remaining'} value={money(summary.remaining)} strong />
          </tbody>
        </table>
      </section>

      {summary.byCategory.length > 0 && (
        <section aria-labelledby="r-categories">
          <h3 id="r-categories" className="mb-2 text-label font-medium text-text-secondary">
            Spend by category
          </h3>
          <table className="tnum w-full text-body">
            <tbody>
              {summary.byCategory.map((c) => (
                <tr key={c.categoryId} className="border-t border-border">
                  <td className="py-1">{c.name}</td>
                  <td className="py-1 text-right text-text-secondary">{Math.round(c.percent)}%</td>
                  <td className="w-28 py-1 text-right">{money(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {budgets.length > 0 && (
        <section aria-labelledby="r-budgets">
          <h3 id="r-budgets" className="mb-2 text-label font-medium text-text-secondary">
            Budgets
          </h3>
          <table className="tnum w-full text-body">
            <tbody>
              {budgets.map((b) => (
                <tr key={b.category.id} className="border-t border-border">
                  <td className="py-1">{b.category.name}</td>
                  <td className="py-1 text-right text-text-secondary">
                    {money(b.spent)} of {money(b.limit)}
                  </td>
                  <td className="w-28 py-1 text-right">{b.level === 'over' ? `Over by ${money(-b.left)}` : `${Math.round(b.percent)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="r-transactions">
        <h3 id="r-transactions" className="mb-2 text-label font-medium text-text-secondary">
          Transactions ({rows.length})
        </h3>
        <table className="tnum w-full text-label">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-1 font-medium">Date</th>
              <th className="py-1 font-medium">Description</th>
              <th className="py-1 font-medium">Category</th>
              <th className="py-1 font-medium">Paid with</th>
              <th className="py-1 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const income = t.type === 'income'
              const category = income ? incomeKind(t.categoryId).name : (catName.get(t.categoryId) ?? 'Other')
              const info = refunds.get(t.id)
              const amount = t.type === 'expense' ? netAmount(t, info) : t.amount
              return (
                <tr key={t.id} className="border-t border-border align-top">
                  <td className="py-1 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="py-1">
                    {t.note || category}
                    {t.fixedExpenseId ? ' (auto)' : ''}
                    {info && info.total > 0 ? ` · ${money(info.total)} back` : ''}
                  </td>
                  <td className="py-1">{category}</td>
                  <td className="py-1">{paymentMethodName(t.paymentMethod) ?? ''}</td>
                  <td className="py-1 text-right whitespace-nowrap">{income ? `+${money(amount)}` : money(amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </article>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className="border-t border-border">
      <td className={strong ? 'py-1 font-medium' : 'py-1 text-text-secondary'}>{label}</td>
      <td className={strong ? 'py-1 text-right font-medium' : 'py-1 text-right'}>{value}</td>
    </tr>
  )
}
