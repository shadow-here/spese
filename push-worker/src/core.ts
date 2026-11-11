/**
 * Spese push server — the logic, with no Cloudflare APIs so it can be unit-tested.
 *
 * Privacy by design: per phone it keeps only the browser's push address (endpoint + keys), the
 * reminder time and timezone, and the date it last sent. It sends an EMPTY push ("wake up");
 * the phone writes the message from its own data. No amounts, names or categories ever arrive here.
 */

export interface PushSubscriptionJSON {
  endpoint: string
  keys?: { p256dh: string; auth: string }
}

export interface Subscriber {
  subscription: PushSubscriptionJSON
  /** "HH:MM", 24-hour, in the phone's timezone. */
  time: string
  /** IANA timezone, e.g. "Asia/Kolkata". */
  timeZone: string
  /** Local date (YYYY-MM-DD) a reminder was last sent, so it's sent at most once a day. */
  lastSent?: string
}

export function isValidTime(time: unknown): time is string {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Only real push services, over https — so this can't be used to make requests elsewhere. */
export function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false
  try {
    const u = new URL(endpoint)
    return (
      u.protocol === 'https:' &&
      /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.api\.chromecast\.com)$/.test(u.hostname)
    )
  } catch {
    return false
  }
}

/** Local date and time for a timezone at an instant. */
export function localNow(timeZone: string, at: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** Due when the local time has reached the reminder time and nothing was sent today (catches up after downtime). */
export function isDue(sub: Subscriber, at: Date): boolean {
  const { date, time } = localNow(sub.timeZone, at)
  return time >= sub.time && sub.lastSent !== date
}

/** KV key for a subscription: SHA-256 of the endpoint, so keys don't expose the address. */
export async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// --- VAPID (RFC 8292): a signed JWT tells the push service the request is from us ---

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface VapidKeys {
  /** Uncompressed P-256 public key, base64url (what the browser's applicationServerKey needs). */
  publicKey: string
  /** Private key as a JWK (kty EC, crv P-256, d, x, y). */
  privateJwk: JsonWebKey
}

export async function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string, now = Date.now()): Promise<string> {
  const audience = new URL(endpoint).origin
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })))
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  // WebCrypto returns the raw r||s signature JWS ES256 expects.
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${claims}`))
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`
}

/** An empty Web Push request (no payload, so nothing to encrypt and nothing to read). */
export async function buildPushRequest(sub: PushSubscriptionJSON, keys: VapidKeys, subject: string, now = Date.now()): Promise<Request> {
  return new Request(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(12 * 3600), // drop it if the phone stays offline for 12 hours
      Urgency: 'normal',
      Authorization: await vapidAuthorization(sub.endpoint, keys, subject, now),
      'Content-Length': '0',
    },
  })
}

/** 404 / 410 from the push service mean the subscription is gone for good (app deleted, permission revoked). */
export function isGone(status: number): boolean {
  return status === 404 || status === 410
}
