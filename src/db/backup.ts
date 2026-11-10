import type { Category, FixedExpense, PayCycle, Transaction, User } from '../domain/types'
import { isISODate } from '../lib/date'
import { db as defaultDb, type TrackerDB } from './db'

// Internal id from before the app was named Spese. Kept so existing backup files (and the
// IndexedDB database, also named 'tracker') keep working — never shown to the user.
export const BACKUP_APP = 'tracker'
export const BACKUP_VERSION = 1
/** Remind to back up when the last backup (or setup) is older than this. */
export const BACKUP_REMINDER_DAYS = 14

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  data: {
    users: User[]
    cycles: PayCycle[]
    transactions: Transaction[]
    fixedExpenses: FixedExpense[]
    categories: Category[]
  }
}

export class BackupError extends Error {}

/**
 * Everything on the device as one JSON-able object. The file records `now` as its backup
 * time; call markBackedUp(now) once the file is actually saved, so a cancelled share
 * doesn't silence the reminder.
 */
export async function createBackup(database: TrackerDB = defaultDb, now = Date.now()): Promise<Backup> {
  return database.transaction('r', [database.users, database.cycles, database.transactions, database.fixedExpenses, database.categories], async () => {
    const [users, cycles, transactions, fixedExpenses, categories] = await Promise.all([
      database.users.toArray().then((us) => us.map((u) => ({ ...u, lastBackupAt: now }))),
      database.cycles.toArray(),
      database.transactions.toArray(),
      database.fixedExpenses.toArray(),
      database.categories.toArray(),
    ])
    return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), data: { users, cycles, transactions, fixedExpenses, categories } }
  })
}

export async function markBackedUp(now = Date.now(), database: TrackerDB = defaultDb): Promise<void> {
  await database.users.update('me', { lastBackupAt: now })
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `spese-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

// --- validation: a restore replaces everything, so check every row before touching the DB ---

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isPaise = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v)
const isPositivePaise = (v: unknown) => isPaise(v) && (v as number) > 0
const isDay = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31

function check(cond: boolean, what: string) {
  if (!cond) throw new BackupError(`This backup file is damaged or not from this app (${what})`)
}

function validateRows(data: Record<string, unknown>) {
  for (const key of ['users', 'cycles', 'transactions', 'fixedExpenses', 'categories']) check(Array.isArray(data[key]), key)
  const users = data.users as unknown[]
  check(users.length === 1, 'users')
  const u = users[0]
  check(isObj(u) && u.id === 'me' && isDay(u.payDay) && isPositivePaise(u.defaultSalary), 'user')

  const cycles = data.cycles as unknown[]
  check(cycles.length > 0, 'cycles')
  const cycleIds = new Set<string>()
  for (const c of cycles) {
    check(isObj(c) && isStr(c.id) && isISODate(c.start) && isISODate(c.end) && (c.start as string) <= (c.end as string), 'cycle dates')
    check(isPaise((c as Record<string, unknown>).salary) && ['open', 'closed'].includes((c as Record<string, unknown>).status as string), 'cycle')
    cycleIds.add((c as Record<string, unknown>).id as string)
  }

  const categoryIds = new Set<string>()
  for (const c of data.categories as unknown[]) {
    check(isObj(c) && isStr(c.id) && isStr(c.name), 'category')
    categoryIds.add((c as Record<string, unknown>).id as string)
  }

  for (const t of data.transactions as unknown[]) {
    check(isObj(t) && isStr(t.id) && cycleIds.has(t.cycleId as string), 'transaction cycle')
    const r = t as Record<string, unknown>
    check(['expense', 'income', 'auto'].includes(r.type as string) && isPositivePaise(r.amount) && isISODate(r.date) && isStr(r.categoryId), 'transaction')
  }

  for (const f of data.fixedExpenses as unknown[]) {
    check(isObj(f) && isStr(f.id) && isStr(f.name), 'fixed expense')
    const r = f as Record<string, unknown>
    check(isPositivePaise(r.amount) && isDay(r.deductionDay) && isISODate(r.activeFrom) && typeof r.isPaused === 'boolean', 'fixed expense')
  }
}

/** Parse + validate a backup file's text. Throws BackupError with a readable message. */
export function parseBackup(text: string): Backup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new BackupError('That file isn’t a backup (not valid JSON)')
  }
  check(isObj(json) && json.app === BACKUP_APP, 'app')
  const b = json as Record<string, unknown>
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new BackupError('This backup is from a newer version of the app')
  check(isObj(b.data), 'data')
  validateRows(b.data as Record<string, unknown>)
  return json as Backup
}

/** Replace all data with the backup, atomically: either everything is restored or nothing changes. */
export async function restoreBackup(backup: Backup, database: TrackerDB = defaultDb): Promise<void> {
  const { users, cycles, transactions, fixedExpenses, categories } = backup.data
  await database.transaction('rw', [database.users, database.cycles, database.transactions, database.fixedExpenses, database.categories], async () => {
    await Promise.all([database.users.clear(), database.cycles.clear(), database.transactions.clear(), database.fixedExpenses.clear(), database.categories.clear()])
    await database.users.bulkAdd(users)
    await database.cycles.bulkAdd(cycles)
    await database.transactions.bulkAdd(transactions)
    await database.fixedExpenses.bulkAdd(fixedExpenses)
    await database.categories.bulkAdd(categories)
  })
}

/** FR-6.2 delete all data: wipes the database; the app returns to onboarding. */
export async function deleteAllData(database: TrackerDB = defaultDb): Promise<void> {
  await database.delete()
  await database.open()
}

/** True when it's time to nag: no backup (or setup) within the last 14 days. */
export function backupOverdue(user: User, now = Date.now()): boolean {
  const since = user.lastBackupAt ?? user.createdAt
  return now - since > BACKUP_REMINDER_DAYS * 86_400_000
}
