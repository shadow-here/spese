import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { db } from '../db/db'
import { ensureCurrentCycle, onboard } from '../db/cycles'
import { addFixedExpense } from '../db/fixedExpenses'
import { addExpense } from '../db/transactions'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 11, 10, 12, 0)) // 10 Dec 2026
  window.location.hash = '#/dashboard'
  await db.delete()
  await db.open()
  // Onboard in November so there is a past cycle to switch to.
  await onboard({ salary: 5000000, payDay: 1, today: '2026-11-15' }, db)
  await addExpense({ amount: 100000, categoryId: 'food', date: '2026-11-20' }, '2026-11-20', db)
  await ensureCurrentCycle('2026-12-10', db)
  await addFixedExpense({ name: 'Rent', amount: 1500000, categoryId: 'bills', deductionDay: 5 }, '2026-12-10', { deductThisCycle: true }, db)
  await addFixedExpense({ name: 'Gym', amount: 150000, categoryId: 'health', deductionDay: 20 }, '2026-12-10', {}, db)
  await addExpense({ amount: 24000, categoryId: 'food', date: '2026-12-09', note: 'Lunch' }, '2026-12-10', db)
  await addExpense({ amount: 60000, categoryId: 'transport', date: '2026-12-10', note: 'Cab' }, '2026-12-10', db)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('dashboard', () => {
  it('shows the balance card with fixed costs still to come', async () => {
    render(<App />)
    // 50,000 − 15,000 rent − 240 − 600 = 34,160
    expect(await screen.findByText('₹34,160.00')).toBeInTheDocument()
    expect(screen.getByText(/68%/)).toBeInTheDocument()
    expect(screen.getByText(/22/, { selector: 'span' })).toBeInTheDocument() // 22 days left (10–31 Dec)
    expect(screen.getByText(/fixed still to come/)).toHaveTextContent('₹1,500 fixed still to come · ₹32,660 free to spend')
  })

  it('splits income into fixed, spent and remaining', async () => {
    render(<App />)
    const card = (await screen.findByRole('heading', { name: 'Income vs outflow' })).closest('section')!
    const values = within(card).getAllByRole('definition').map((d) => d.textContent)
    expect(values).toEqual(['₹15,000', '₹840', '₹34,160'])
  })

  it('ranks categories by amount with shares', async () => {
    render(<App />)
    const card = (await screen.findByRole('heading', { name: 'Spend by category' })).closest('section')!
    const rows = within(card).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toEqual(['Bills95%₹15,000', 'Transport4%₹600', 'Food2%₹240'])
  })

  it('lists recent transactions with the Auto tag', async () => {
    render(<App />)
    const card = (await screen.findByRole('heading', { name: 'Recent transactions' })).closest('section')!
    expect(within(card).getByText('Cab')).toBeInTheDocument()
    expect(within(card).getByText('Auto')).toBeInTheDocument()
  })

  it('shows safe to spend, fixed share and last cycle’s savings', async () => {
    render(<App />)
    const tile = async (name: string) => (await screen.findByRole('region', { name })).textContent
    // free to spend 32,660 over 22 days (10–31 Dec) = 1,484.5 → ₹1,484
    expect(await tile('Safe to spend today')).toBe('Safe to spend today₹1,484for 22 days')
    // (15,000 rent + 1,500 gym) ÷ 50,000
    expect(await tile('Fixed costs')).toBe('Fixed costs33%of income')
    // November: 50,000 − 1,000 (loads with the cycle history)
    await waitFor(async () => expect(await tile('Saved last cycle')).toBe('Saved last cycle₹49,00098% of income'))
  })

  it('lists what is due in the next 7 days', async () => {
    await addFixedExpense({ name: 'WiFi', amount: 79900, categoryId: 'bills', deductionDay: 14 }, '2026-12-10', {}, db)
    render(<App />)
    const card = (await screen.findByRole('heading', { name: 'Next 7 days' })).closest('section')!
    expect(within(card).getByText('WiFi')).toBeInTheDocument()
    expect(within(card).getByText('Mon 14 Dec')).toBeInTheDocument()
    expect(within(card).queryByText('Gym')).not.toBeInTheDocument() // 20 Dec is more than a week away
  })

  it('compares this cycle with the last one', async () => {
    render(<App />)
    // The chart loads in its own chunk; wait for the real card, not its placeholder.
    await waitFor(() => {
      const card = screen.getByRole('heading', { name: 'Month over month' }).closest('section')!
      expect(within(card).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1 Nov₹1,000', 'This cycle₹15,840 so far'])
    })
    expect(screen.queryByRole('heading', { name: 'Savings rate' })).not.toBeInTheDocument() // needs 2 finished cycles
  })

  it('switches to a past cycle', async () => {
    render(<App />)
    const select = await screen.findByLabelText('Pay cycle')
    const november = within(select).getByRole('option', { name: '1 Nov – 30 Nov' }) as HTMLOptionElement
    fireEvent.change(select, { target: { value: november.value } })
    expect(await screen.findByText('Left at cycle end (saved)')).toBeInTheDocument()
    expect(await screen.findByText('₹49,000.00')).toBeInTheDocument()
  })
})
