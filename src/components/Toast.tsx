import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastData {
  id: number
  message: string
  action?: { label: string; onAction: () => void }
  durationMs: number
}

interface ToastApi {
  show: (message: string, options?: { action?: ToastData['action']; durationMs?: number }) => void
}

const ToastContext = createContext<ToastApi>({ show: () => {} })

export const useToast = () => useContext(ToastContext)

/** One toast at a time, above the mobile tab bar. Announced to screen readers via aria-live. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData>()
  const seq = useRef(0)

  const show = useCallback<ToastApi['show']>((message, options = {}) => {
    setToast({ id: ++seq.current, message, action: options.action, durationMs: options.durationMs ?? 5000 })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast((t) => (t?.id === toast.id ? undefined : t)), toast.durationMs)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6"
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex h-10 items-center gap-4 rounded-card border border-border bg-surface-hover pr-1.5 pl-4 text-body animate-sheet-in"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onAction()
                  setToast(undefined)
                }}
                className="h-7 rounded-control px-2.5 text-body font-medium text-text-primary underline-offset-2 transition-quick hover:bg-surface hover:underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
