import { db } from '../db/db'
import { isIOS, isStandalone } from './platform'
import { fromBase64Url } from './pin'
import { allowSystemUi } from './systemUi'

/**
 * Daily reminders (v1.1 Phase 7, PRD #23/#24) — the phone side. Talks to the Spese push server
 * (push-worker/), whose address is baked in at build time as VITE_PUSH_URL. The server only ever
 * receives this phone's push address, the reminder time and the timezone.
 */

export const PUSH_URL: string | undefined = import.meta.env.VITE_PUSH_URL?.replace(/\/$/, '') || undefined

export type ReminderSupport = 'not-configured' | 'unsupported' | 'install-first' | 'blocked' | 'ok'

export function reminderSupport(): ReminderSupport {
  if (!PUSH_URL) return 'not-configured'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iPhone Safari only gets push once Spese is added to the Home Screen.
    return isIOS() && !isStandalone() ? 'install-first' : 'unsupported'
  }
  if (isIOS() && !isStandalone()) return 'install-first'
  if (Notification.permission === 'denied') return 'blocked'
  return 'ok'
}

async function call(path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${PUSH_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Push server said ${res.status}`)
  return res
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Ask permission, subscribe this phone, and register the time with the server. */
export async function enableReminders(time: string): Promise<void> {
  allowSystemUi() // the permission prompt isn't "leaving Spese"
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications weren’t allowed')
  const reg = await navigator.serviceWorker.ready
  const { publicKey } = (await (await call('/vapid-key')).json()) as { publicKey: string }
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey) }))
  await call('/subscribe', { subscription: subscription.toJSON(), time, timeZone: timeZone() })
  await db.users.update('me', { reminder: { time, endpoint: subscription.endpoint } })
}

export async function changeReminderTime(time: string): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return enableReminders(time)
  await call('/subscribe', { subscription: subscription.toJSON(), time, timeZone: timeZone() })
  await db.users.update('me', { reminder: { time, endpoint: subscription.endpoint } })
}

export async function disableReminders(): Promise<void> {
  const subscription = await currentSubscription()
  if (subscription) {
    await call('/unsubscribe', { endpoint: subscription.endpoint }).catch(() => undefined) // still turn off locally
    await subscription.unsubscribe()
  }
  await db.users.update('me', { reminder: undefined })
}

export async function sendTestReminder(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) throw new Error('Reminders aren’t on for this phone')
  await call('/test', { endpoint: subscription.endpoint })
}
