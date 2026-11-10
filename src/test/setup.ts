import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Full-app tests (IndexedDB + React) run in parallel and can be slow under load; the
// 1 s default for findBy*/waitFor made a couple of them flaky.
configure({ asyncUtilTimeout: 3000 })

// jsdom's Blob lacks text() (all real browsers have it).
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub
}
