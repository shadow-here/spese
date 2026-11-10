import type { PayCycle, Transaction } from '../domain/types'
import { todayISO, type ISODate } from '../lib/date'
import { runAutoDeductions } from './autoDeduct'
import { ensureCurrentCycle } from './cycles'
import { db as defaultDb, type TrackerDB } from './db'

export type StartupResult =
  | { status: 'needs-onboarding' }
  | { status: 'ready'; cycle: PayCycle; created: Transaction[] }

/** Run on every app open (and on resume): roll cycles forward, then back-fill deductions. */
export async function startup(today: ISODate = todayISO(), database: TrackerDB = defaultDb): Promise<StartupResult> {
  if (!(await database.users.get('me'))) return { status: 'needs-onboarding' }
  const cycle = await ensureCurrentCycle(today, database)
  const created = await runAutoDeductions(today, database)
  return { status: 'ready', cycle, created }
}
