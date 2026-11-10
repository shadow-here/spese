import 'fake-indexeddb/auto'
import { addCategory, categoryUsage, moveCategory, removeCategory, updateCategory } from './categories'
import { onboard } from './cycles'
import { TrackerDB } from './db'
import { addFixedExpense } from './fixedExpenses'
import { addRefund } from './refunds'
import { addExpense } from './transactions'
import { CATEGORY_PALETTE, nextCategoryColour } from '../domain/categories'

let database: TrackerDB
let n = 0

beforeEach(async () => {
  database = new TrackerDB(`cat-test-${++n}`)
  await database.open()
  await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, database)
})
afterEach(async () => {
  await database.delete()
})

const names = async () => (await database.categories.orderBy('order').toArray()).map((c) => c.name)

describe('adding', () => {
  it('adds at the end with the first unused palette colour', async () => {
    const c = await addCategory({ name: '  Groceries ', icon: 'shopping-cart' }, database)
    expect(c).toMatchObject({ name: 'Groceries', colour: CATEGORY_PALETTE[7], isDefault: false, order: 7 })
    expect((await names()).at(-1)).toBe('Groceries')
  })

  it('rejects blank, too long and duplicate names (case-insensitive)', async () => {
    await expect(addCategory({ name: ' ', icon: 'coffee' }, database)).rejects.toThrow('name')
    await expect(addCategory({ name: 'x'.repeat(25), icon: 'coffee' }, database)).rejects.toThrow('under 24')
    await expect(addCategory({ name: 'food', icon: 'coffee' }, database)).rejects.toThrow('already a category called “Food”')
  })

  it('shares the least-used colour once all 8 are taken', () => {
    const used = CATEGORY_PALETTE.map((colour) => ({ colour }))
    expect(nextCategoryColour(used)).toBe(CATEGORY_PALETTE[0])
    expect(nextCategoryColour([...used, { colour: CATEGORY_PALETTE[0] }])).toBe(CATEGORY_PALETTE[1])
  })
})

describe('editing', () => {
  it('renames any category, including Other', async () => {
    await updateCategory('other', { name: 'Misc' }, database)
    await updateCategory('food', { name: 'Eating out', icon: 'coffee', colour: '#E66767' }, database)
    expect(await database.categories.get('other')).toMatchObject({ name: 'Misc' })
    expect(await database.categories.get('food')).toMatchObject({ name: 'Eating out', icon: 'coffee', colour: '#E66767' })
    await expect(updateCategory('food', { name: 'misc' }, database)).rejects.toThrow('already')
    await updateCategory('food', { name: 'EATING OUT' }, database) // same category, new casing is fine
  })

  it('reorders up and down', async () => {
    await moveCategory('transport', -1, database)
    expect((await names()).slice(0, 2)).toEqual(['Transport', 'Food'])
    await moveCategory('other', 1, database) // already last: no-op
    await moveCategory('food', -1, database)
    expect((await names()).slice(0, 2)).toEqual(['Food', 'Transport'])
  })
})

describe('removing', () => {
  it('moves expenses, refunds and fixed expenses to the chosen category, then deletes', async () => {
    const e = await addExpense({ amount: 180000, categoryId: 'entertainment', date: '2026-11-05' }, '2026-11-10', database)
    await addRefund(e.id, { amount: 60000, date: '2026-11-06' }, '2026-11-10', database)
    await addFixedExpense({ name: 'Netflix', amount: 64900, categoryId: 'entertainment', deductionDay: 20 }, '2026-11-10', {}, database)
    expect(await categoryUsage('entertainment', database)).toEqual({ transactions: 2, fixedExpenses: 1 })

    await removeCategory('entertainment', 'shopping', database)
    expect(await database.categories.get('entertainment')).toBeUndefined()
    expect((await database.transactions.toArray()).map((t) => t.categoryId)).toEqual(['shopping', 'shopping'])
    expect((await database.fixedExpenses.toArray())[0]!.categoryId).toBe('shopping')
    expect(await names()).toEqual(['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'])
    expect((await database.categories.orderBy('order').toArray()).map((c) => c.order)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('never removes Other, and leaves recurring income alone', async () => {
    await expect(removeCategory('other', 'food', database)).rejects.toThrow('fallback')
    await expect(removeCategory('food', 'food', database)).rejects.toThrow('different')
    await addFixedExpense({ name: 'Bonus', amount: 100, categoryId: 'income-bonus', deductionDay: 20 }, '2026-11-10', { direction: 'in' }, database)
    await removeCategory('food', 'other', database)
    expect((await database.fixedExpenses.toArray())[0]!.categoryId).toBe('income-bonus')
  })
})
