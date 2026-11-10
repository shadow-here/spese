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

export const FALLBACK_CATEGORY_ID = 'other'
