import { FALLBACK_CATEGORY_ID, MAX_CATEGORY_NAME, nextCategoryColour } from '../domain/categories'
import type { Category } from '../domain/types'
import { db as defaultDb, newId, type TrackerDB } from './db'
import { ValidationError } from './transactions'

/**
 * Manage spending categories (v1.1 Phase 3, PRD #21): add, rename (including "Other"),
 * change icon/colour, reorder, and remove — moving anything that uses it to another category.
 * Income kinds are separate (domain/income.ts) and not managed here.
 */

export interface CategoryInput {
  name: string
  icon: string
  colour?: string
}

async function checkName(name: string, database: TrackerDB, exceptId?: string): Promise<string> {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) throw new ValidationError('Give the category a name')
  if (trimmed.length > MAX_CATEGORY_NAME) throw new ValidationError(`Keep it under ${MAX_CATEGORY_NAME} characters`)
  const clash = (await database.categories.toArray()).find((c) => c.id !== exceptId && c.name.toLowerCase() === trimmed.toLowerCase())
  if (clash) throw new ValidationError(`There's already a category called “${clash.name}”`)
  return trimmed
}

function checkColour(colour: string) {
  if (!/^#[0-9a-f]{6}$/i.test(colour)) throw new ValidationError('Pick a colour')
}

export async function addCategory(input: CategoryInput, database: TrackerDB = defaultDb): Promise<Category> {
  return database.transaction('rw', database.categories, async () => {
    const name = await checkName(input.name, database)
    const all = await database.categories.toArray()
    const colour = input.colour ?? nextCategoryColour(all)
    checkColour(colour)
    const category: Category = {
      id: newId(),
      name,
      icon: input.icon,
      colour,
      isDefault: false,
      order: all.reduce((m, c) => Math.max(m, c.order), -1) + 1,
    }
    await database.categories.add(category)
    return category
  })
}

export async function updateCategory(id: string, patch: Partial<CategoryInput>, database: TrackerDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.categories, async () => {
    if (!(await database.categories.get(id))) throw new ValidationError('Category not found')
    const changes: Partial<Category> = {}
    if (patch.name !== undefined) changes.name = await checkName(patch.name, database, id)
    if (patch.icon !== undefined) changes.icon = patch.icon
    if (patch.colour !== undefined) {
      checkColour(patch.colour)
      changes.colour = patch.colour
    }
    await database.categories.update(id, changes)
  })
}

/** Move a category one step up (-1) or down (+1) in the list. Order also drives chip and chart order. */
export async function moveCategory(id: string, step: -1 | 1, database: TrackerDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.categories, async () => {
    const all = await database.categories.orderBy('order').toArray()
    const i = all.findIndex((c) => c.id === id)
    const j = i + step
    if (i < 0 || j < 0 || j >= all.length) return
    ;[all[i], all[j]] = [all[j]!, all[i]!]
    await Promise.all(all.map((c, order) => (c.order === order ? undefined : database.categories.update(c.id, { order }))))
  })
}

export interface CategoryUsage {
  transactions: number
  fixedExpenses: number
}

/** How many entries use a category (refunds included, since they follow their expense). */
export async function categoryUsage(id: string, database: TrackerDB = defaultDb): Promise<CategoryUsage> {
  const [transactions, fixed] = await Promise.all([
    database.transactions.where('categoryId').equals(id).count(),
    database.fixedExpenses.filter((f) => f.categoryId === id && f.direction !== 'in').count(),
  ])
  return { transactions, fixedExpenses: fixed }
}

/**
 * Remove a category. Everything that uses it — expenses, refunds, auto-deductions, fixed
 * expenses — moves to `moveToId` first, all in one transaction. "Other" can't be removed.
 */
export async function removeCategory(id: string, moveToId: string = FALLBACK_CATEGORY_ID, database: TrackerDB = defaultDb): Promise<void> {
  if (id === FALLBACK_CATEGORY_ID) throw new ValidationError('“Other” is the fallback category — rename it instead')
  if (moveToId === id) throw new ValidationError('Pick a different category to move entries to')
  await database.transaction('rw', database.categories, database.transactions, database.fixedExpenses, async () => {
    if (!(await database.categories.get(id))) throw new ValidationError('Category not found')
    if (!(await database.categories.get(moveToId))) throw new ValidationError('Pick a category to move entries to')
    await database.transactions.where('categoryId').equals(id).modify({ categoryId: moveToId })
    await database.fixedExpenses.filter((f) => f.categoryId === id && f.direction !== 'in').modify({ categoryId: moveToId })
    await database.categories.delete(id)
    const rest = await database.categories.orderBy('order').toArray()
    await Promise.all(rest.map((c, order) => (c.order === order ? undefined : database.categories.update(c.id, { order }))))
  })
}
