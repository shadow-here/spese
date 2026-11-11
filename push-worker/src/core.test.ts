// @vitest-environment node
import { buildPushRequest, isDue, isGone, isValidEndpoint, isValidTime, isValidTimeZone, keyFor, localNow, vapidAuthorization, type VapidKeys } from './core'

async function makeKeys(): Promise<{ keys: VapidKeys; verifyKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const publicKey = Buffer.from(raw).toString('base64url')
  return { keys: { publicKey, privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) }, verifyKey: pair.publicKey }
}

describe('input checks', () => {
  it('accepts 24-hour times and real timezones', () => {
    expect(['00:00', '09:30', '21:00', '23:59'].every(isValidTime)).toBe(true)
    expect(['24:00', '9:30', '21:60', 'nine', 2100].some(isValidTime)).toBe(false)
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
  })
  it('only accepts real push services over https', () => {
    expect(isValidEndpoint('https://web.push.apple.com/QGuQyavX')).toBe(true)
    expect(isValidEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isValidEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false)
    expect(isValidEndpoint('https://evil.example/fcm.googleapis.com')).toBe(false)
    expect(isValidEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false)
  })
})

describe('scheduling', () => {
  const at = new Date('2026-11-10T15:31:00Z') // 21:01 in India (UTC+5:30)
  it('works out local time in the phone’s timezone', () => {
    expect(localNow('Asia/Kolkata', at)).toEqual({ date: '2026-11-10', time: '21:01' })
    expect(localNow('America/New_York', at)).toEqual({ date: '2026-11-10', time: '10:31' })
  })
  it('is due once the time has come, at most once a day, and catches up after downtime', () => {
    const sub = { subscription: { endpoint: 'https://fcm.googleapis.com/x' }, time: '21:00', timeZone: 'Asia/Kolkata' }
    expect(isDue(sub, at)).toBe(true)
    expect(isDue({ ...sub, lastSent: '2026-11-10' }, at)).toBe(false)
    expect(isDue({ ...sub, lastSent: '2026-11-09' }, at)).toBe(true)
    expect(isDue({ ...sub, time: '21:05' }, at)).toBe(false)
    expect(isDue({ ...sub, time: '18:00' }, at)).toBe(true) // server was down at 18:00: still sends today
  })
  it('hashes the endpoint for the storage key', async () => {
    const k = await keyFor('https://fcm.googleapis.com/x')
    expect(k).toMatch(/^[0-9a-f]{64}$/)
    expect(k).not.toContain('googleapis')
  })
})

describe('VAPID', () => {
  it('signs a JWT the push service can verify, for the endpoint’s origin', async () => {
    const { keys, verifyKey } = await makeKeys()
    const now = Date.UTC(2026, 10, 10)
    const auth = await vapidAuthorization('https://web.push.apple.com/abc', keys, 'https://spese-lake.vercel.app', now)
    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(auth)!
    expect(k).toBe(keys.publicKey)
    const [h, c, s] = token!.split('.')
    const claims = JSON.parse(Buffer.from(c!, 'base64url').toString())
    expect(claims).toEqual({ aud: 'https://web.push.apple.com', exp: now / 1000 + 12 * 3600, sub: 'https://spese-lake.vercel.app' })
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ typ: 'JWT', alg: 'ES256' })
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, Buffer.from(s!, 'base64url'), new TextEncoder().encode(`${h}.${c}`))
    expect(ok).toBe(true)
  })

  it('builds an empty push with TTL and Authorization', async () => {
    const { keys } = await makeKeys()
    const req = await buildPushRequest({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }, keys, 'https://spese-lake.vercel.app')
    expect(req.method).toBe('POST')
    expect(req.headers.get('TTL')).toBe('43200')
    expect(req.headers.get('Authorization')).toMatch(/^vapid t=.+, k=/)
    expect(await req.text()).toBe('')
  })

  it('treats 404 and 410 as a dead subscription', () => {
    expect([404, 410].every(isGone)).toBe(true)
    expect([201, 429, 500].some(isGone)).toBe(false)
  })
})
