import { useEffect, useRef } from 'react'

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Single-key shortcut (e.g. "n"), ignored while typing or with modifier keys held.
 * The listener stays registered; `enabled` is read live from a ref, so there is no gap
 * after a sheet closes where the key is dropped.
 */
export function useHotkey(key: string, handler: () => void, enabled = true) {
  const handlerRef = useRef(handler)
  const enabledRef = useRef(enabled)
  handlerRef.current = handler
  enabledRef.current = enabled
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!enabledRef.current || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        handlerRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [key])
}
