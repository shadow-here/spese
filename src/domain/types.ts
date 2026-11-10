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
  /** Set only on auto-deductions. */
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

export interface FixedExpense {
  id: string
  name: string
  amount: Paise
  categoryId: string
  /** 1–31; short months use their last day. */
  deductionDay: number
  frequency: Frequency
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
