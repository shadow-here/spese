/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { TrackerDB } from './db/db'
import { todayISO } from './lib/date'
import { composeReminder, type Reminder } from './push/compose'

/**
 * Spese's service worker (custom since v1.1 Phase 7, built by vite-plugin-pwa "injectManifest").
 * - Offline: precaches the app shell and serves it for every navigation, as before.
 * - Updates: waits until the page says SKIP_WAITING (the "Update ready — Reload" banner).
 * - Reminders: the push server sends an empty push; the message is written here, from the data
 *   on this phone, so no amount or name ever passes through the server.
 */
declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') void self.skipWaiting()
})

async function buildReminder(): Promise<Reminder> {
  const db = new TrackerDB()
  try {
    const [user, cycle, fixedExpenses, categories] = await Promise.all([
      db.users.get('me'),
      db.cycles.where('status').equals('open').last(),
      db.fixedExpenses.toArray(),
      db.categories.toArray(),
    ])
    const transactions = cycle ? await db.transactions.where('cycleId').equals(cycle.id).toArray() : []
    return composeReminder({ user, cycle, transactions, fixedExpenses, categories, today: todayISO() })
  } catch {
    return { title: 'Spese', body: 'Logged today’s spending? Tap to add it.' }
  } finally {
    db.close()
  }
}

self.addEventListener('push', (event) => {
  // Every push must show a notification (iOS revokes permission otherwise).
  event.waitUntil(
    buildReminder().then(({ title, body }) =>
      self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: 'spese-daily', // a newer reminder replaces an unread one
      }),
    ),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows[0]
      if (open) {
        await open.focus()
        return
      }
      await self.clients.openWindow('/#/dashboard')
    })(),
  )
})
