import { lazy, Suspense, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '../app/EmptyState'
import { Button, Card, Select } from '../components/ui'
import { db } from '../db/db'
import { summarizeCycle } from '../domain/balance'
import { budgetRows } from '../domain/budgets'
import { cycleHistory, monthOverMonth, upcomingInNextWeek } from '../domain/history'
import { refundsByExpense } from '../domain/refunds'
import type { PayCycle, Transaction } from '../domain/types'
import { BackupReminder } from '../features/backup/BackupReminder'
import { BalanceCard } from '../features/dashboard/BalanceCard'
import { AlertsBanner } from '../features/dashboard/AlertsBanner'
import { BudgetsCard } from '../features/dashboard/BudgetsCard'
import { GoalCard } from '../features/dashboard/GoalCard'
import { OutflowBar } from '../features/dashboard/OutflowBar'
import { StatTiles } from '../features/dashboard/StatTiles'
import { UpcomingCard } from '../features/dashboard/UpcomingCard'
import { SalaryConfirm } from '../features/cycle/SalaryConfirm'
import { TransactionRow } from '../features/expenses/TransactionRow'
import { minDate, type ISODate } from '../lib/date'
import { formatRange } from '../lib/format'

// The charting library is the bulk of the bundle: load it in its own chunk so the
// balance card (the number people open the app for) renders without waiting on it.
const CategoryBreakdown = lazy(() => import('../features/dashboard/CategoryBreakdown').then((m) => ({ default: m.CategoryBreakdown })))
const DailyTrend = lazy(() => import('../features/dashboard/DailyTrend').then((m) => ({ default: m.DailyTrend })))
const MonthOverMonth = lazy(() => import('../features/dashboard/MonthOverMonth').then((m) => ({ default: m.MonthOverMonth })))
const SavingsTrend = lazy(() => import('../features/dashboard/SavingsTrend').then((m) => ({ default: m.SavingsTrend })))

/** How many cycles back the comparisons look (savings trend uses all of them; month-over-month the last 4). */
const HISTORY_CYCLES = 12

/** Same-size empty card while a chart chunk loads, so nothing below jumps. */
function ChartSlot({ title, height }: { title: string; height: number }) {
  return (
    <Card title={title}>
      <div style={{ height }} />
    </Card>
  )
}

/**
 * Dashboard (Key screen 1): balance card, income vs outflow, category donut, daily trend,
 * recent transactions. Defaults to the current cycle; past cycles via the selector (FR-4.1).
 * Everything is a live query, so any edit recalculates instantly (FR-4.2).
 */
export function DashboardPage({
  currentCycle,
  today,
  onAdd,
  onEdit,
  onViewAll,
}: {
  currentCycle: PayCycle
  today: ISODate
  onAdd: () => void
  onEdit: (tx: Transaction) => void
  onViewAll: () => void
}) {
  const [selectedId, setSelectedId] = useState(currentCycle.id)
  const cycles = useLiveQuery(() => db.cycles.orderBy('start').reverse().toArray(), [])
  const cycle = cycles?.find((c) => c.id === selectedId) ?? currentCycle
  const isCurrent = cycle.id === currentCycle.id

  const data = useLiveQuery(async () => {
    const [transactions, fixedExpenses, categories, allRefunds] = await Promise.all([
      db.transactions.where('cycleId').equals(cycle.id).toArray(),
      db.fixedExpenses.toArray(),
      db.categories.toArray(),
      // Refunds from any cycle, so a row can say "₹X back" even if the money came later.
      db.transactions.where('type').equals('refund').toArray(),
    ])
    return { cycleId: cycle.id, transactions, fixedExpenses, categories, allRefunds }
  }, [cycle.id])
  // Ignore the previous cycle's result while the newly selected one loads (no flash of wrong numbers).
  const fresh = data?.cycleId === cycle.id ? data : undefined

  // The viewed cycle and up to 11 before it, for month-over-month and the savings trend.
  const historyData = useLiveQuery(async () => {
    const past = await db.cycles.where('start').belowOrEqual(cycle.start).reverse().limit(HISTORY_CYCLES).toArray()
    const transactions = await db.transactions.where('cycleId').anyOf(past.map((c) => c.id)).toArray()
    return { cycleId: cycle.id, cycles: past, transactions }
  }, [cycle.id, cycle.start])
  const history = useMemo(
    () =>
      fresh && historyData?.cycleId === cycle.id
        ? cycleHistory(historyData.cycles, historyData.transactions, fresh.fixedExpenses, fresh.categories, today)
        : undefined,
    [fresh, historyData, cycle.id, today],
  )
  const finished = history?.filter((h) => h.savingsRate !== undefined) ?? []
  const mom = history && history.length >= 2 ? monthOverMonth(history, today) : undefined
  const user = useLiveQuery(() => db.users.get('me'), [])
  const upcoming = useMemo(
    () => (fresh && isCurrent ? upcomingInNextWeek(fresh.fixedExpenses, fresh.transactions, today) : []),
    [fresh, isCurrent, today],
  )

  // A past cycle is viewed as of its last day.
  const asOf = isCurrent ? today : minDate(today, cycle.end)
  const summary = useMemo(() => (fresh ? summarizeCycle({ cycle, today: asOf, ...fresh }) : undefined), [fresh, cycle, asOf])
  const budgets = useMemo(() => (summary && fresh ? budgetRows(summary, fresh.categories) : []), [summary, fresh])
  const catById = useMemo(() => new Map(fresh?.categories.map((c) => [c.id, c])), [fresh])
  const refunds = useMemo(
    () => (fresh ? refundsByExpense(fresh.allRefunds, new Map(fresh.transactions.map((t) => [t.id, t]))) : new Map()),
    [fresh],
  )
  if (!summary || !fresh) return null

  return (
    <div className="flex flex-col gap-4">
      {cycles && cycles.length > 1 && (
        <div className="max-w-xs">
          <Select label="Pay cycle" value={cycle.id} onChange={(e) => setSelectedId(e.target.value)}>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {formatRange(c.start, c.end)}
                {c.id === currentCycle.id ? ' (current)' : ''}
              </option>
            ))}
          </Select>
        </div>
      )}
      {isCurrent && !cycle.salaryConfirmed && <SalaryConfirm cycle={cycle} />}
      {isCurrent && <BackupReminder />}
      <BalanceCard summary={summary} isCurrent={isCurrent} />
      {isCurrent && <AlertsBanner summary={summary} budgets={budgets} />}
      {isCurrent && (
        <StatTiles summary={summary} lastFinished={finished.at(-1)} historyLoaded={history !== undefined} savingsGoal={user?.savingsGoal} />
      )}
      {isCurrent && user?.savingsGoal !== undefined && <GoalCard summary={summary} goal={user.savingsGoal} />}
      {isCurrent && <UpcomingCard items={upcoming} today={today} categories={fresh.categories} />}
      <BudgetsCard rows={budgets} />

      {summary.isEmpty ? (
        <EmptyState
          icon={LayoutDashboard}
          title={isCurrent ? 'No expenses yet' : 'Nothing logged in this cycle'}
          body="Add your first expense to see where your money goes."
          action={
            isCurrent ? (
              <Button variant="primary" onClick={onAdd}>
                Add expense
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <OutflowBar summary={summary} />
          <Suspense fallback={<ChartSlot title="Spend by category" height={176} />}>
            <CategoryBreakdown items={summary.byCategory} categories={fresh.categories} />
          </Suspense>
          <Suspense fallback={<ChartSlot title="Daily trend" height={340} />}>
            <DailyTrend daily={summary.daily} today={asOf} isCurrent={isCurrent} />
          </Suspense>
          {mom && (
            <Suspense fallback={<ChartSlot title="Month over month" height={300} />}>
              <MonthOverMonth data={mom} />
            </Suspense>
          )}
          {finished.length >= 2 && (
            <Suspense fallback={<ChartSlot title="Savings rate" height={210} />}>
              <SavingsTrend finished={finished} />
            </Suspense>
          )}
          <Card
            title="Recent transactions"
            action={
              <Button variant="ghost" size="sm" onClick={onViewAll}>
                View all
              </Button>
            }
          >
            {summary.recent.map((t) => (
              <TransactionRow key={t.id} tx={t} category={catById.get(t.categoryId)} refunds={refunds.get(t.id)} showDate onClick={() => onEdit(t)} />
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
