import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { LockScreen, PrivacyShield } from './app/LockScreen'
import { useAppLock } from './app/useAppLock'
import { useLiveQuery } from 'dexie-react-hooks'
import { AppShell } from './app/AppShell'
import { UpdatePrompt } from './app/UpdatePrompt'
import { useRoute, type RouteId } from './app/routes'
import { useHotkey } from './app/useHotkey'
import { useStartup } from './app/useStartup'
import { useToday } from './app/useToday'
import { ToastProvider } from './components/Toast'
import { Button } from './components/ui'
import { db } from './db/db'
import type { Direction, FixedExpense, Transaction } from './domain/types'
import { ExpenseSheet } from './features/expenses/ExpenseSheet'
import { FixedSheet } from './features/fixed/FixedSheet'
import type { ISODate } from './lib/date'
import { FixedPage } from './pages/Fixed'
import { OnboardingPage } from './pages/Onboarding'
import { DashboardPage } from './pages/Dashboard'
import { SettingsPage } from './pages/Settings'
import { focusTransactionSearch, TransactionsPage } from './pages/Transactions'
import { UiKitPage } from './pages/UiKit'
import { ReportPage } from './pages/Report'

const TITLES: Record<RouteId, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  fixed: 'Fixed expenses',
  settings: 'Settings',
  report: 'Cycle report',
  ui: 'UI kit',
}

export default function App() {
  return (
    <ToastProvider>
      <Boot />
      <UpdatePrompt />
    </ToastProvider>
  )
}

function Boot() {
  const today = useToday()
  const [boot, rerun] = useStartup(today)

  // Mark first meaningful render, for checking the "opens in < 2 s" target (DevTools > Performance).
  useEffect(() => {
    if (boot.status !== 'loading' && performance.getEntriesByName('app-ready').length === 0) performance.mark('app-ready')
  }, [boot.status])

  switch (boot.status) {
    case 'loading':
      // Blank background only — no spinner flash on a fast open.
      return null
    case 'error':
      return (
        <main role="alert" className="mx-auto flex max-w-sm flex-col gap-3 px-4 pt-[20vh]">
          <h1 className="text-title">Couldn’t open your data</h1>
          <p className="text-body text-text-secondary">{boot.message}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </main>
      )
    case 'needs-onboarding':
      return <OnboardingPage today={today} onDone={rerun} />
    case 'ready':
      return (
        <LockGate>
          <MainApp cycleId={boot.cycleId} today={today} />
        </LockGate>
      )
  }
}

/** App lock (PRD #27): while locked, the app behind isn't rendered at all — only the lock screen. */
function LockGate({ children }: { children: ReactNode }) {
  const { lock, locked, shielded, unlock } = useAppLock()
  if (lock === undefined) return null // lock setting still loading: show nothing rather than flash data
  if (lock && locked) return <LockScreen lock={lock} onUnlock={unlock} />
  return (
    <>
      {children}
      {shielded && <PrivacyShield />}
    </>
  )
}

type SheetState = { open: false } | { open: true; editing?: Transaction }

function MainApp({ cycleId, today }: { cycleId: string; today: ISODate }) {
  const [route, navigate, routeParam] = useRoute()
  const [sheet, setSheet] = useState<SheetState>({ open: false })
  const openAdd = useCallback(() => setSheet({ open: true }), [])
  const openEdit = useCallback((tx: Transaction) => setSheet({ open: true, editing: tx }), [])
  const closeSheet = useCallback(() => setSheet({ open: false }), [])
  const [fixedSheet, setFixedSheet] = useState<{ open: boolean; editing?: FixedExpense; direction?: Direction }>({ open: false })
  const cycle = useLiveQuery(() => db.cycles.get(cycleId), [cycleId])

  useHotkey('n', openAdd, !sheet.open && !fixedSheet.open)
  // "/" = search (Design system keyboard map): jump to Transactions and focus the search box.
  useHotkey(
    '/',
    () => {
      if (route !== 'transactions') navigate('transactions')
      focusTransactionSearch()
    },
    !sheet.open && !fixedSheet.open,
  )

  return (
    <>
      <AppShell route={route} onNavigate={navigate} onAdd={openAdd} title={TITLES[route]}>
        {route === 'dashboard' && cycle && (
          <DashboardPage
            key={cycle.id /* reset the cycle selector when a new cycle opens */}
            currentCycle={cycle}
            today={today}
            onAdd={openAdd}
            onEdit={openEdit}
            onViewAll={() => navigate('transactions')}
            onReport={(id) => navigate('report', id)}
          />
        )}
        {route === 'transactions' && <TransactionsPage today={today} onAdd={openAdd} onEdit={openEdit} />}
        {route === 'fixed' && (
          <FixedPage
            today={today}
            onAdd={(direction) => setFixedSheet({ open: true, direction })}
            onEdit={(fe) => setFixedSheet({ open: true, editing: fe })}
          />
        )}
        {route === 'settings' && <SettingsPage today={today} />}
        {route === 'report' && <ReportPage cycleId={routeParam} today={today} onBack={() => navigate('dashboard')} />}
        {route === 'ui' && <UiKitPage />}
      </AppShell>

      <ExpenseSheet open={sheet.open} onClose={closeSheet} today={today} editing={sheet.open ? sheet.editing : undefined} />
      <FixedSheet
        open={fixedSheet.open}
        editing={fixedSheet.editing}
        direction={fixedSheet.direction}
        today={today}
        onClose={() => setFixedSheet((s) => ({ ...s, open: false }))}
      />
    </>
  )
}
