import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('switches to a past cycle', async () => {
    render(<App />)
    const select = await screen.findByLabelText('Pay cycle')
    const november = within(select).getByRole('option', { name: '1 Nov – 30 Nov' }) as HTMLOptionElement
    fireEvent.change(select, { target: { value: november.value } })
    expect(await screen.findByText('Left at cycle end (saved)')).toBeInTheDocument()
    expect(await screen.findByText('₹49,000.00')).toBeInTheDocument()
  })
})
