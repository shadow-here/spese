import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { LockScreen, PrivacyShield } from './app/LockScreen'
import { SHEET_ROOT_ID } from './components/ui/BottomSheet'
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
  const [everUnlocked, setEverUnlocked] = useState(false)
  useEffect(() => {
    if (lock !== undefined && (!lock || !locked)) setEverUnlocked(true)
  }, [lock, locked])
  // Page-wide keys (N, /, a sheet's Esc and Tab) check this and stay quiet while locked.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-locked', Boolean(lock && locked))
  }, [lock, locked])

  if (lock === undefined) return null // lock setting still loading: show nothing rather than flash data
  // Fresh open: nothing is rendered behind the lock screen.
  if (lock && locked && !everUnlocked) return <LockScreen lock={lock} onUnlock={unlock} />
  // Locked again after leaving: the app stays mounted underneath — inert and covered — so a
  // half-typed expense or an open screen is still there when you come back.
  const relocked = Boolean(lock && locked)
  return (
    <>
      <div inert={relocked} aria-hidden={relocked || undefined} className="contents">
        {children}
        {/* Sheets render here (not on <body>) so they're inert behind the lock too. */}
        <div id={SHEET_ROOT_ID} />
      </div>
      {relocked && lock && <LockScreen lock={lock} onUnlock={unlock} />}
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
