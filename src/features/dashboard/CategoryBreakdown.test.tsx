import { render, screen, within } from '@testing-library/react'
import { CategoryBreakdown, donutSegments, REST } from './CategoryBreakdown'
import type { CategorySpend } from '../../domain/balance'
import type { Category } from '../../domain/types'

const cats = (n: number): Category[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Cat ${i}`, icon: 'circle-dashed', colour: '#3987E5', isDefault: false, order: i }))

// Ranked by amount, biggest first, as summarizeCycle provides them.
const spend = (c: Category[]): CategorySpend[] =>
  c.map((x, i) => ({ categoryId: x.id, name: x.name, colour: x.colour, amount: (c.length - i) * 10000, percent: 0 }))

describe('donutSegments', () => {
  it('keeps every category when there are 8 or fewer', () => {
    const c = cats(8)
    const { donut, foldedIds } = donutSegments(spend(c), c)
    expect(donut.map((d) => d.categoryId)).toEqual(c.map((x) => x.id))
    expect(foldedIds.size).toBe(0)
  })

  it('folds everything past the 7 biggest into one "N more" segment, never exceeding 8', () => {
    const c = cats(10)
    const { donut, foldedIds } = donutSegments(spend(c), c)
    expect(donut).toHaveLength(8)
    expect(donut.slice(0, 7).map((d) => d.categoryId)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
    expect(donut[7]).toMatchObject({ categoryId: REST, name: '3 more', amount: 30000 + 20000 + 10000 })
    expect([...foldedIds]).toEqual(['c7', 'c8', 'c9'])
  })

  it('orders kept segments by category order, not by amount', () => {
    const c = cats(3)
    const items = spend(c).reverse() // pretend c2 is biggest
    expect(donutSegments(items, c).donut.map((d) => d.categoryId)).toEqual(['c0', 'c1', 'c2'])
  })
})

describe('CategoryBreakdown', () => {
  it('still names all categories in the ranked list', () => {
    const c = cats(10)
    render(<CategoryBreakdown items={spend(c)} categories={c} />)
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(10)
  })
})
