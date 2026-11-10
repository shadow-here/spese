import { useEffect, useState } from 'react'

/** Save a text file: share sheet on phones (iOS home-screen apps can't download), download elsewhere. */
export async function saveTextFile(filename: string, text: string, mime = 'application/json'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], filename, { type: mime })
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  if (coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // fall through to a normal download
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}

// --- Install (Add to Home Screen) ---

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | undefined
const listeners = new Set<() => void>()

// Registered at module load so the early event isn't missed.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = undefined
    listeners.forEach((l) => l())
  })
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Install state: 'installed', 'prompt' (Chrome/Android can show the install dialog), 'ios' (manual steps), or 'unavailable'. */
export function useInstall(): { state: 'installed' | 'prompt' | 'ios' | 'unavailable'; install: () => Promise<void> } {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  const state = isStandalone() ? 'installed' : deferredPrompt ? 'prompt' : isIOS() ? 'ios' : 'unavailable'
  return {
    state,
    install: async () => {
      if (!deferredPrompt) return
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
      deferredPrompt = undefined
      force((n) => n + 1)
    },
  }
}

/** Ask the browser not to evict our IndexedDB under storage pressure. Returns whether storage is persistent. */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  if (!navigator.storage?.persist) return undefined
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
