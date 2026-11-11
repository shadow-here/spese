/**
 * PIN hashing for the app lock (v1.1 Phase 7). The PIN itself is never stored — only a salted
 * PBKDF2-SHA-256 hash. Note: the lock is a privacy screen (someone picking up your phone can't
 * open Spese); it does not encrypt the data stored on the device.
 */

export const PIN_MIN = 4
export const PIN_MAX = 6
const ITERATIONS = 210_000

export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4)
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)
}

export interface PinHash {
  hash: string
  salt: string
  iterations: number
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return toBase64Url(bits)
}

export async function hashPin(pin: string, iterations = ITERATIONS): Promise<PinHash> {
  if (!isValidPin(pin)) throw new Error(`PIN must be ${PIN_MIN}–${PIN_MAX} digits`)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { hash: await derive(pin, salt, iterations), salt: toBase64Url(salt), iterations }
}

/** Constant-time-ish comparison of the derived hash. */
export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  if (!isValidPin(pin)) return false
  const candidate = await derive(pin, fromBase64Url(stored.salt), stored.iterations)
  if (candidate.length !== stored.hash.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i)
  return diff === 0
}
