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

export type TransactionType = 'expense' | 'income' | 'auto'

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
  /** P1. */
  monthlyLimit?: Paise
}
