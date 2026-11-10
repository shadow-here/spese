import { useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'
import { Button } from '../components/ui'

const HOUR = 60 * 60 * 1000

/**
 * Registers the service worker and shows "A new version is ready — Reload" when a deploy has
 * been downloaded. Nothing reloads by itself, so an update can't interrupt an entry.
 * Updates are checked on open, when the app comes back to the foreground (a home-screen app is
 * resumed, not re-opened), and hourly while it stays open.
 */
export function UpdatePrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      registrationRef.current = registration
      const check = () => {
        if (navigator.onLine && registration.installing === null) void registration.update().catch(() => undefined)
      }
      window.setInterval(check, HOUR)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })

  async function reload() {
    // Normal case: a new worker is waiting — activate it; the page reloads once it takes over.
    if (registrationRef.current?.waiting) {
      await updateServiceWorker(true)
      return
    }
    // The new worker is already active (e.g. this page was opened before any worker controlled
    // it), so there is nothing to activate — a plain reload loads the new version.
    window.location.reload()
  }

  if (!needRefresh) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-[calc(8px+env(safe-area-inset-top))] z-[70] flex justify-center px-4"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-card border border-border bg-surface-hover py-1.5 pr-1.5 pl-3 text-body animate-sheet-in">
        <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-text-secondary" />
        <span className="flex-1">A new version of Spese is ready</span>
        <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button variant="primary" size="sm" onClick={() => void reload()}>
          Reload
        </Button>
      </div>
    </div>
  )
}
