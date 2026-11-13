import { useLayoutEffect, useRef } from 'react'

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Single-key shortcut (e.g. "n"), ignored while typing or with modifier keys held.
 * The listener stays registered; `enabled` is read live from a ref, so there is no gap
 * after a sheet closes where the key is dropped. It's attached in a layout effect — in the
 * same commit that paints the screen — so the key works the moment the screen is visible.
 * (A plain effect left a short window after mount where "N" was ignored; flaky tests caught it.)
 */
export function useHotkey(key: string, handler: () => void, enabled = true) {
  const handlerRef = useRef(handler)
  const enabledRef = useRef(enabled)
  handlerRef.current = handler
  enabledRef.current = enabled
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!enabledRef.current || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.documentElement.hasAttribute('data-locked')) return // the lock screen owns the keyboard
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        handlerRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [key])
}
