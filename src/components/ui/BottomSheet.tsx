import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

/**
 * Modal bottom sheet (12px top radius). Esc or backdrop click closes it; focus moves
 * into the sheet on open and returns to the opener on close. On desktop it centres.
 */
export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Keep the latest onClose without re-running the open/close effect on every render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not([data-close])')
    ;(first ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      } else if (e.key === 'Tab' && panel) {
        // Keep focus inside the sheet.
        const items = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (items.length === 0) return
        const firstItem = items[0]!
        const lastItem = items[items.length - 1]!
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault()
          lastItem.focus()
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault()
          firstItem.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-bg/70 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-lg rounded-t-sheet border border-b-0 border-border bg-surface animate-sheet-in',
          'pb-[max(16px,env(safe-area-inset-bottom))] md:rounded-sheet md:border-b',
          'focus:outline-none',
          className,
        )}
      >
        <header className="flex h-12 items-center justify-between px-4">
          <h2 id={titleId} className="text-body font-medium text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-control text-text-secondary transition-quick hover:bg-surface-hover hover:text-text-primary"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>
        <div className="px-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
