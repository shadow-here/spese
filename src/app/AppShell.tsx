import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '../lib/cn'
import { NAV, type RouteId } from './routes'

interface AppShellProps {
  route: RouteId
  onNavigate: (id: RouteId) => void
  onAdd: () => void
  title: string
  children: ReactNode
}

/**
 * Desktop (md+): left sidebar with nav and the add button.
 * Mobile: bottom tab bar with a centred add button — reachable from every screen (FR-2.2).
 */
export function AppShell({ route, onNavigate, onAdd, title, children }: AppShellProps) {
  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-12 items-center px-4 text-body font-semibold tracking-[-0.01em]">Tracker</div>
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onAdd}
            className="flex h-8 w-full items-center gap-2 rounded-control bg-accent px-3 text-body font-medium text-on-accent transition-quick hover:brightness-95"
          >
            <Plus size={16} strokeWidth={1.5} />
            New expense
            <kbd className="ml-auto rounded-[4px] border border-text-primary/20 px-1 text-label font-medium">N</kbd>
          </button>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = route === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2.5 rounded-control px-2.5 text-body transition-quick',
                  active
                    ? 'bg-surface-hover text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                )}
              >
                <Icon size={16} strokeWidth={1.5} className={active ? 'text-accent' : undefined} />
                {label}
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center border-b border-border bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:px-8">
          <h1 className="text-title">{title}</h1>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-28 md:px-8 md:py-6 md:pb-8">{children}</main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-14 grid-cols-5 items-center">
          {NAV.slice(0, 2).map((item) => (
            <TabButton key={item.id} item={item} active={route === item.id} onNavigate={onNavigate} />
          ))}
          <li className="flex justify-center">
            <button
              type="button"
              onClick={onAdd}
              aria-label="New expense"
              className="flex size-10 items-center justify-center rounded-full bg-accent text-on-accent transition-quick active:scale-95"
            >
              <Plus size={20} strokeWidth={1.5} />
            </button>
          </li>
          {NAV.slice(2).map((item) => (
            <TabButton key={item.id} item={item} active={route === item.id} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
    </div>
  )
}

function TabButton({
  item: { id, label, icon: Icon },
  active,
  onNavigate,
}: {
  item: (typeof NAV)[number]
  active: boolean
  onNavigate: (id: RouteId) => void
}) {
  return (
    <li className="flex justify-center">
      <button
        type="button"
        onClick={() => onNavigate(id)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-12 w-full flex-col items-center justify-center gap-1 text-[0.625rem] font-medium transition-quick',
          active ? 'text-text-primary' : 'text-text-secondary',
        )}
      >
        <Icon size={16} strokeWidth={1.5} className={active ? 'text-accent' : undefined} />
        {label}
      </button>
    </li>
  )
}
