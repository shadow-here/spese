import type { ISODate } from '../lib/date'
import type { Paise } from '../lib/money'

/**
 * Core entities (PRD "Data model"). Single-user, on-device app, so the PRD's user_id
 * foreign keys are dropped: there is exactly one User row.
 */

export interface User {
  id: 'me'
  name: string
  currency: 'INR'
  /** 1–31; short months use their last day. */
  payDay: number
  /** Salary used when a new cycle opens (user confirms or edits it — FR-1.3). */
  defaultSalary: Paise
  createdAt: number
  /** Last successful backup export (epoch ms), for the 14-day reminder. */
  lastBackupAt?: number
  /** Savings goal per cycle (FR-5.3): the amount to have left when each cycle ends. */
  savingsGoal?: Paise
  /** App lock (PRD #27). Never included in backups, so a backup is the way back in if the PIN is forgotten. */
  lock?: AppLock
  /** Reminders (PRD #23/#24): the time chosen; the push subscription lives on the push server. */
  reminder?: { time: string; endpoint: string }
}

export interface AppLock {
  /** PBKDF2-SHA-256 of the PIN (base64url), its salt and iteration count. */
  pinHash: string
  salt: string
  iterations: number
  /** Digits in the PIN, so the lock screen can unlock as soon as the last digit is typed. */
  pinLength: number
  /** WebAuthn credential id for Face ID / fingerprint, when turned on. */
  credentialId?: string
}

export type CycleStatus = 'open' | 'closed'

export interface PayCycle {
  id: string
  start: ISODate
  end: ISODate
  salary: Paise
  status: CycleStatus
  /** False until the user confirms this cycle's salary amount (FR-1.3). */
  salaryConfirmed: boolean
}

/**
 * 'refund' = money back on an expense (v1.1 Phase 2). Linked via `refundOf`; never listed on
 * its own — it shows on the expense it belongs to.
 */
export type TransactionType = 'expense' | 'income' | 'auto' | 'refund'

export type PaymentMethod = 'upi' | 'card' | 'cash' | 'other'

export interface Transaction {
  id: string
  cycleId: string
  type: TransactionType
  /** Always positive; type decides the direction. */
  amount: Paise
  categoryId: string
  date: ISODate
  note?: string
  /** P1 field, kept optional so P0 data is forward-compatible. */
  paymentMethod?: PaymentMethod
  /**
   * Set on rows created automatically from a recurring entry: auto-deductions (type 'auto')
   * and recurring income (type 'income'). For income rows, categoryId is an income kind.
   */
  fixedExpenseId?: string
  /**
   * Auto-deductions only: the scheduled date. Together with fixedExpenseId this is the
   * idempotency key, so editing `date` never causes a duplicate deduction.
   */
  dueDate?: ISODate
  /**
   * Refund rows only: the expense this money came back for. Same cycle as the expense → the
   * expense counts net of it; a later cycle → it adds to that later cycle's balance instead.
   * categoryId copies the expense's category.
   */
  refundOf?: string
  /** Auto-deduction skipped for this cycle (FR-3.6). Kept as a row so it is not re-created. */
  skipped?: boolean
  createdAt: number
  updatedAt: number
}

export type Frequency = 'monthly'

/** 'out' = a fixed cost (rent, WiFi); 'in' = recurring income (monthly bonus). */
export type Direction = 'out' | 'in'

/**
 * A recurring monthly entry. Despite the name (kept for stored data), it covers both fixed
 * costs and recurring income: `direction` says which. Missing direction = 'out' (v1.0 rows).
 */
export interface FixedExpense {
  id: string
  name: string
  amount: Paise
  categoryId: string
  /** 1–31; short months use their last day. */
  deductionDay: number
  frequency: Frequency
  /** Optional for rows saved before v1.1; treat missing as 'out'. For 'in', categoryId is an income kind. */
  direction?: Direction
  /** Earliest date a deduction may be created. Moved forward on resume so paused months aren't back-filled. */
  activeFrom: ISODate
  /** Ended fixed expenses create nothing after this date (FR-3.5). */
  endDate?: ISODate
  isPaused: boolean
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: string
  name: string
  /** Lucide icon name. */
  icon: string
  /** Desaturated hex colour for charts. */
  colour: string
  isDefault: boolean
  order: number
  /** Budget per pay cycle (FR-5.1). Undefined = no budget. */
  monthlyLimit?: Paise
}
