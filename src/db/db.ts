import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_CATEGORIES } from '../domain/categories'
import type { Category, FixedExpense, PayCycle, Transaction, User } from '../domain/types'

export class TrackerDB extends Dexie {
  users!: EntityTable<User, 'id'>
  cycles!: EntityTable<PayCycle, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  fixedExpenses!: EntityTable<FixedExpense, 'id'>
  categories!: EntityTable<Category, 'id'>

  constructor(name = 'tracker') {
    super(name)
    this.version(1).stores({
      users: 'id',
      cycles: 'id, start, end, status',
      // [fixedExpenseId+dueDate] keeps auto-deductions idempotent.
      transactions: 'id, cycleId, date, type, categoryId, fixedExpenseId, [fixedExpenseId+dueDate], [cycleId+date]',
      fixedExpenses: 'id, isPaused',
      categories: 'id, order',
    })
    // v2: default category colours replaced with a colour-blind-safe set.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        for (const c of DEFAULT_CATEGORIES) {
          await tx.table('categories').update(c.id, { colour: c.colour })
        }
      })
    this.on('populate', (tx) => {
      void tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
    })
  }
}

export const db = new TrackerDB()

export function newId(): string {
  return crypto.randomUUID()
}
