import type { Category } from './types'

/**
 * Default categories (feature 6). Stable ids so backups and code can reference them.
 *
 * Colours: a fixed categorical order validated on the dark surface (#0F1011) for
 * lightness, chroma, colour-blind separation (worst adjacent ΔE 8.4) and 3:1 contrast.
 * The earlier "desaturated" set failed those checks (two pairs indistinguishable for
 * deuteranopes), so these are the most muted steps that pass. Colour follows the
 * category, never its rank, and charts always pair it with a text label.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food', icon: 'utensils', colour: '#3987E5', isDefault: true, order: 0 },
  { id: 'transport', name: 'Transport', icon: 'car', colour: '#D95926', isDefault: true, order: 1 },
  { id: 'shopping', name: 'Shopping', icon: 'shopping-bag', colour: '#199E70', isDefault: true, order: 2 },
  { id: 'bills', name: 'Bills', icon: 'receipt', colour: '#C98500', isDefault: true, order: 3 },
  { id: 'health', name: 'Health', icon: 'heart-pulse', colour: '#D55181', isDefault: true, order: 4 },
  { id: 'entertainment', name: 'Entertainment', icon: 'clapperboard', colour: '#008300', isDefault: true, order: 5 },
  { id: 'other', name: 'Other', icon: 'circle-dashed', colour: '#9085E9', isDefault: true, order: 6 },
]

/** "Other" is the fallback: it can be renamed but never removed. */
export const FALLBACK_CATEGORY_ID = 'other'

/**
 * The 8 validated chart colours (dark-surface steps), in fixed order. The 7 defaults use the
 * first 7; slot 8 (red) is free for the first custom category. Past 8 categories, colours are
 * shared — charts always label categories by name, and the donut folds extras together.
 */
export const CATEGORY_PALETTE = ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9', '#E66767'] as const

/** First palette colour no category uses yet, else the least-used one. */
export function nextCategoryColour(categories: Pick<Category, 'colour'>[]): string {
  const counts = new Map<string, number>(CATEGORY_PALETTE.map((c) => [c, 0]))
  for (const c of categories) {
    const key = c.colour.toUpperCase()
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1)
  }
  let best: string = CATEGORY_PALETTE[0]
  for (const c of CATEGORY_PALETTE) if (counts.get(c)! < counts.get(best)!) best = c
  return best
}

export const MAX_CATEGORY_NAME = 24
