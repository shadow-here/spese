import {
  buildPushRequest,
  isDue,
  isGone,
  isValidEndpoint,
  isValidTime,
  isValidTimeZone,
  keyFor,
  localNow,
  type Subscriber,
  type VapidKeys,
} from './core'

/**
 * Spese push server (Cloudflare Worker). Deploy steps: docs/PUSH.md.
 *
 *   GET  /vapid-key     → { publicKey }               (the browser needs it to subscribe)
 *   POST /subscribe     { subscription, time, timeZone }   → stores / updates
 *   POST /unsubscribe   { endpoint }                  → forgets the phone
 *   POST /test          { endpoint }                  → sends one reminder now
 *   cron (every 5 min)  → sends today's reminder to everyone whose time has come
 */

// Minimal Cloudflare types, to avoid a dependency.
interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

export interface Env {
  SUBSCRIBERS: KVNamespace
  /** Your app's address, e.g. https://spese-lake.vercel.app — only it may call this server. */
  ALLOWED_ORIGIN: string
  VAPID_PUBLIC_KEY: string
  /** Secret: the private JWK as JSON (set with `wrangler secret put VAPID_PRIVATE_JWK`). */
  VAPID_PRIVATE_JWK: string
  /** Contact for push services: an https URL (your app) or mailto:. */
  VAPID_SUBJECT: string
}

const MAX_SUBSCRIBERS = 50 // a personal app — refuse more than this

function cors(env: Env): HeadersInit {
  return { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
}
const json = (env: Env, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(env) } })
const keysOf = (env: Env): VapidKeys => ({ publicKey: env.VAPID_PUBLIC_KEY, privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK) as JsonWebKey })

async function send(env: Env, key: string, sub: Subscriber): Promise<number> {
  const res = await fetch(await buildPushRequest(sub.subscription, keysOf(env), env.VAPID_SUBJECT))
  if (isGone(res.status)) await env.SUBSCRIBERS.delete(key)
  return res.status
}

async function allKeys(env: Env): Promise<string[]> {
  const out: string[] = []
  let cursor: string | undefined
  do {
    const page = await env.SUBSCRIBERS.list({ cursor })
    out.push(...page.keys.map((k) => k.name))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) })
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 })
    const path = new URL(request.url).pathname

    if (request.method === 'GET' && path === '/vapid-key') return json(env, { publicKey: env.VAPID_PUBLIC_KEY })
    if (request.method !== 'POST') return json(env, { error: 'Not found' }, 404)

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return json(env, { error: 'Bad JSON' }, 400)
    }

    if (path === '/subscribe') {
      const subscription = body.subscription as Subscriber['subscription'] | undefined
      if (!subscription || !isValidEndpoint(subscription.endpoint)) return json(env, { error: 'Not a push subscription' }, 400)
      if (!isValidTime(body.time) || !isValidTimeZone(body.timeZone)) return json(env, { error: 'Bad time or timezone' }, 400)
      const key = await keyFor(subscription.endpoint)
      const existing = await env.SUBSCRIBERS.get(key)
      if (!existing && (await allKeys(env)).length >= MAX_SUBSCRIBERS) return json(env, { error: 'Too many subscribers' }, 429)
      const previous = existing ? (JSON.parse(existing) as Subscriber) : undefined
      // Keep lastSent when only the time changes, so moving the time later doesn't send twice in a day.
      const sub: Subscriber = { subscription: { endpoint: subscription.endpoint, keys: subscription.keys }, time: body.time, timeZone: body.timeZone, lastSent: previous?.lastSent }
      await env.SUBSCRIBERS.put(key, JSON.stringify(sub))
      return json(env, { ok: true })
    }

    if (path === '/unsubscribe' || path === '/test') {
      if (!isValidEndpoint(body.endpoint)) return json(env, { error: 'Bad endpoint' }, 400)
      const key = await keyFor(body.endpoint)
      if (path === '/unsubscribe') {
        await env.SUBSCRIBERS.delete(key)
        return json(env, { ok: true })
      }
      const stored = await env.SUBSCRIBERS.get(key)
      if (!stored) return json(env, { error: 'Not subscribed' }, 404)
      const status = await send(env, key, JSON.parse(stored) as Subscriber)
      return json(env, { ok: status < 300, status })
    }

    return json(env, { error: 'Not found' }, 404)
  },

  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date()
    ctx.waitUntil(
      (async () => {
        for (const key of await allKeys(env)) {
          const raw = await env.SUBSCRIBERS.get(key)
          if (!raw) continue
          const sub = JSON.parse(raw) as Subscriber
          if (!isDue(sub, now)) continue
          const status = await send(env, key, sub)
          if (status < 300) await env.SUBSCRIBERS.put(key, JSON.stringify({ ...sub, lastSent: localNow(sub.timeZone, now).date }))
        }
      })(),
    )
  },
}
