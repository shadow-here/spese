import 'fake-indexeddb/auto'
import { onboard } from './cycles'
import { TrackerDB } from './db'
import { exportTransactionsCsv } from './exportCsv'
import { addFixedExpense } from './fixedExpenses'
import { addRefund } from './refunds'
import { addExpense, addIncome } from './transactions'
import { toCsv } from '../lib/csv'

describe('toCsv', () => {
  it('quotes commas, quotes and newlines, adds a BOM and CRLF', () => {
    expect(toCsv([['a', 'b,c', 'say "hi"', 'two\nlines', 12, undefined]])).toBe('﻿a,"b,c","say ""hi""","two\nlines",12,\r\n')
  })
  it('defuses spreadsheet formulas in text cells but leaves numbers, even as strings', () => {
    expect(toCsv([['=SUM(A1)', '+91 98', '-cmd', '-1800.50', -5]])).toBe("﻿'=SUM(A1),'+91 98,'-cmd,-1800.50,-5\r\n")
  })
})

describe('exportTransactionsCsv', () => {
  let database: TrackerDB
  beforeEach(async () => {
    database = new TrackerDB(`csv-test-${Math.random()}`)
    await database.open()
    await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, database)
  })
  afterEach(async () => {
    await database.delete()
  })

  it('writes one signed row per entry, oldest first', async () => {
    const dinner = await addExpense({ amount: 180050, categoryId: 'food', date: '2026-11-05', note: 'Dinner, with "friends"', paymentMethod: 'card' }, '2026-11-10', database)
    await addRefund(dinner.id, { amount: 60000, date: '2026-11-06', note: 'Rahul' }, '2026-11-10', database)
    await addIncome({ amount: 500000, categoryId: 'income-bonus', date: '2026-11-07' }, '2026-11-10', database)
    await addFixedExpense({ name: 'Rent', amount: 1500000, categoryId: 'bills', deductionDay: 2 }, '2026-11-10', { deductThisCycle: true }, database)

    const lines = (await exportTransactionsCsv(database)).replace('﻿', '').trim().split('\r\n')
    expect(lines).toEqual([
      'Date,Type,Category,Note,Amount (₹),Paid with,Pay cycle start,Refund for',
      '2026-11-02,Fixed,Bills,Rent,-15000,,2026-11-01,',
      '2026-11-05,Expense,Food,"Dinner, with ""friends""",-1800.50,Card,2026-11-01,',
      '2026-11-06,Refund,Food,Rahul,600,,2026-11-01,"2026-11-05 Dinner, with ""friends"""',
      '2026-11-07,Income,Bonus,,5000,,2026-11-01,',
    ])
  })
})
