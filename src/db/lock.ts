import type { AppLock } from '../domain/types'
import { hashPin, verifyPin } from '../lib/pin'
import { db as defaultDb, type TrackerDB } from './db'

/** App lock storage (v1.1 Phase 7, PRD #27). */

export async function getLock(database: TrackerDB = defaultDb): Promise<AppLock | undefined> {
  return (await database.users.get('me'))?.lock
}

export async function enableLock(pin: string, database: TrackerDB = defaultDb, iterations?: number): Promise<void> {
  const h = await hashPin(pin, iterations)
  await database.users.update('me', { lock: { pinHash: h.hash, salt: h.salt, iterations: h.iterations, pinLength: pin.length } })
}

export async function checkPin(pin: string, database: TrackerDB = defaultDb): Promise<boolean> {
  const lock = await getLock(database)
  return lock ? verifyPin(pin, { hash: lock.pinHash, salt: lock.salt, iterations: lock.iterations }) : false
}

/** Change the PIN (the current one is required). Keeps Face ID if it was on. */
export async function changePin(current: string, next: string, database: TrackerDB = defaultDb, iterations?: number): Promise<boolean> {
  const lock = await getLock(database)
  if (!lock || !(await checkPin(current, database))) return false
  const h = await hashPin(next, iterations)
  await database.users.update('me', { lock: { ...lock, pinHash: h.hash, salt: h.salt, iterations: h.iterations, pinLength: next.length } })
  return true
}

/** Turn the lock off (the PIN is required). */
export async function disableLock(pin: string, database: TrackerDB = defaultDb): Promise<boolean> {
  if (!(await checkPin(pin, database))) return false
  await database.users.update('me', { lock: undefined })
  return true
}

export async function setBiometric(credentialId: string | undefined, database: TrackerDB = defaultDb): Promise<void> {
  const lock = await getLock(database)
  if (!lock) throw new Error('Turn on the app lock first')
  await database.users.update('me', { lock: { ...lock, credentialId } })
}
