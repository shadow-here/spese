import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { db } from './db/db'
import { createBackup } from './db/backup'
import { ensureCurrentCycle, onboard } from './db/cycles'
import { todayISO } from './lib/date'

beforeEach(async () => {
  window.location.hash = ''
  await db.delete()
  await db.open()
})

describe('onboarding', () => {
  it('shows onboarding first, validates salary, then lands on the dashboard', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Spese' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    const salary = await screen.findByLabelText('Net monthly salary (in-hand)')
    fireEvent.click(screen.getByRole('button', { name: 'Start tracking' }))
    expect(await screen.findByText('Enter your monthly in-hand salary')).toBeInTheDocument()

    fireEvent.change(salary, { target: { value: '52,500.50' } })
    fireEvent.change(screen.getByLabelText('Salary arrives on'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start tracking' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Add fixed costs' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    const user = await db.users.get('me')
    expect(user).toMatchObject({ payDay: 25, defaultSalary: 5250050 })
    expect((await screen.findAllByText('₹52,500.50')).length).toBeGreaterThan(0)
  })
})

describe('welcome screen', () => {
  it('restores a backup without onboarding and lands on the dashboard', async () => {
    // Make a backup on a set-up device, then wipe it like a reinstall.
    await onboard({ salary: 5000000, payDay: 1, today: todayISO() }, db)
    const backup = JSON.stringify(await createBackup(db))
    await db.delete()
    await db.open()

    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Spese' })
    fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [new File([backup], 'spese-backup.json')] } })
    const confirm = await screen.findByRole('group', { name: 'Confirm restore' })
    expect(confirm).not.toHaveTextContent('can’t be undone') // nothing to overwrite on a fresh device
    fireEvent.click(within(confirm).getByRole('button', { name: 'Restore' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect((await db.users.get('me'))!.defaultSalary).toBe(5000000)
  })

  it('is not shown once set up', async () => {
    await onboard({ salary: 5000000, payDay: 1, today: todayISO() }, db)
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument()
  })
})

describe('app shell', () => {
  beforeEach(async () => {
    await onboard({ salary: 5000000, payDay: 1, today: todayISO() }, db)
  })

  it('opens the add sheet with N and closes it with Esc', async () => {
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    fireEvent.keyDown(document, { key: 'n' })
    expect(screen.getByRole('dialog', { name: 'New expense' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ignores N while typing in an input', async () => {
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'n' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    input.remove()
  })
})

describe('expenses', () => {
  beforeEach(async () => {
    await onboard({ salary: 5000000, payDay: 1, today: todayISO() }, db)
  })

  async function addViaSheet(amount: string, category?: string, note?: string) {
    fireEvent.keyDown(document, { key: 'n' })
    const dialog = await screen.findByRole('dialog', { name: 'New expense' })
    const amountInput = within(dialog).getByLabelText('Amount')
    await waitFor(() => expect(amountInput).toHaveFocus())
    fireEvent.change(amountInput, { target: { value: amount } })
    if (category) fireEvent.click(within(dialog).getByRole('button', { name: category }))
    if (note) fireEvent.change(within(dialog).getByLabelText('Note'), { target: { value: note } })
    fireEvent.submit(amountInput.closest('form')!) // Enter in the form
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  }

  it('adds an expense with Enter and updates the balance', async () => {
    render(<App />)
    await screen.findByText('₹50,000.00')
    await addViaSheet('240', 'Transport', 'Auto rickshaw')
    expect(await screen.findByText('Auto rickshaw')).toBeInTheDocument()
    expect(await screen.findByText('₹49,760.00')).toBeInTheDocument()
    const [tx] = await db.transactions.toArray()
    expect(tx).toMatchObject({ amount: 24000, categoryId: 'transport', date: todayISO(), note: 'Auto rickshaw' })
  })

  it('adds one-off income with the Income switch and shows it on the dashboard', async () => {
    render(<App />)
    await screen.findByText('₹50,000.00')
    fireEvent.keyDown(document, { key: 'n' })
    let dialog = await screen.findByRole('dialog', { name: 'New expense' })
    const radio = within(dialog).getByRole('radio', { name: 'Income' })
    radio.focus()
    fireEvent.click(radio)
    dialog = await screen.findByRole('dialog', { name: 'New income' })
    const amount = within(dialog).getByLabelText('Amount')
    await waitFor(() => expect(amount).toHaveFocus()) // focus goes back to the amount after switching
    fireEvent.change(amount, { target: { value: '5000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Freelance' }))
    fireEvent.change(within(dialog).getByLabelText('Note'), { target: { value: 'Logo design' } })
    fireEvent.submit(amount.closest('form')!)

    expect(await screen.findByText('₹55,000.00')).toBeInTheDocument()
    expect(screen.getByText(/other income/)).toHaveTextContent('Salary ₹50,000 + ₹5,000 other income')
    expect(await screen.findByText('Logo design')).toBeInTheDocument()
    expect(screen.getByText('+₹5,000.00')).toBeInTheDocument()
    expect((await db.transactions.toArray())[0]).toMatchObject({ type: 'income', categoryId: 'income-freelance', amount: 500000 })
  })

  it('records a refund on an expense: shows net amount and "back", no separate row', async () => {
    render(<App />)
    await screen.findByText('₹50,000.00')
    await addViaSheet('1800', 'Food', 'Dinner')
    expect(await screen.findByText('₹48,200.00')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /Dinner/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit expense' })
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Add refund' }))
    const form = within(dialog).getByRole('form', { name: 'Add refund' })
    fireEvent.change(within(form).getByLabelText('Amount back'), { target: { value: '600' } })
    fireEvent.change(within(form).getByLabelText('Refund note'), { target: { value: "Rahul's share" } })
    fireEvent.submit(form)

    expect(await within(dialog).findByText(/Rahul's share/)).toBeInTheDocument()
    expect(within(dialog).getByText(/counts as/)).toHaveTextContent('₹600 back · counts as ₹1,200')
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(await screen.findByText('₹48,800.00')).toBeInTheDocument() // balance: 50,000 − 1,200
    const recent = screen.getByRole('heading', { name: 'Recent transactions' }).closest('section')!
    expect(within(recent).getByText('₹1,200.00')).toBeInTheDocument()
    expect(within(recent).getByText('₹600 back')).toBeInTheDocument()
    expect(within(recent).getAllByRole('button').filter((b) => /Dinner/.test(b.textContent ?? ''))).toHaveLength(1)
    expect(within(recent).queryByText(/Rahul/)).not.toBeInTheDocument()
  })

  it('requires an amount', async () => {
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    fireEvent.keyDown(document, { key: 'n' })
    const dialog = await screen.findByRole('dialog', { name: 'New expense' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter an amount')).toBeInTheDocument()
    expect(await db.transactions.count()).toBe(0)
  })

  it('pre-selects the last-used category', async () => {
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    await addViaSheet('100', 'Health')
    fireEvent.keyDown(document, { key: 'n' })
    const dialog = await screen.findByRole('dialog', { name: 'New expense' })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Health' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('edits, then deletes with confirmation and undo', async () => {
    window.location.hash = '#/transactions'
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Transactions' })
    await addViaSheet('100', 'Food', 'Chai')

    fireEvent.click(await screen.findByRole('button', { name: /Chai/ }))
    let dialog = await screen.findByRole('dialog', { name: 'Edit expense' })
    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '120' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await db.transactions.toArray())[0]!.amount).toBe(12000))

    fireEvent.click(await screen.findByRole('button', { name: /Chai/ }))
    dialog = await screen.findByRole('dialog', { name: 'Edit expense' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    const confirm = within(dialog).getByRole('group', { name: 'Confirm delete' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect(await db.transactions.count()).toBe(0))

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect(await db.transactions.count()).toBe(1))
    expect(await screen.findByRole('button', { name: /Chai/ })).toBeInTheDocument()
  })
})

describe('fixed expenses', () => {
  beforeEach(async () => {
    // Fake only Date so Dexie's timers keep working.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 10, 12, 0)) // 10 Nov 2026
    await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, db)
    window.location.hash = '#/fixed'
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function fillFixed(name: string, amount: string, day: string) {
    const dialog = await screen.findByRole('dialog', { name: 'New fixed expense' })
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: name } })
    fireEvent.change(within(dialog).getByLabelText('Amount per month'), { target: { value: amount } })
    fireEvent.change(within(dialog).getByLabelText('Deducted on'), { target: { value: day } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    return dialog
  }

  it('asks to deduct this cycle when the day has passed, then shows it with next date', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add fixed expense' }))
    const dialog = await fillFixed('Rent', '15000', '5')
    const ask = await within(dialog).findByRole('group', { name: 'Deduct this cycle?' })
    fireEvent.click(within(ask).getByRole('button', { name: 'Yes, deduct' }))

    expect(await screen.findByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('Next 5 Dec')).toBeInTheDocument()
    expect(screen.getByText('₹15,000.00', { selector: 'p' })).toBeInTheDocument() // committed
    const [auto] = await db.transactions.toArray()
    expect(auto).toMatchObject({ type: 'auto', amount: 1500000, date: '2026-11-05', note: 'Rent' })
  })

  it('does not ask when the day is still ahead, and pauses with the switch', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add fixed expense' }))
    await fillFixed('Gym', '1500', '20')
    expect(await screen.findByText('Next 20 Nov')).toBeInTheDocument()
    expect(await db.transactions.count()).toBe(0)

    fireEvent.click(screen.getByRole('switch', { name: 'Active: Gym' }))
    expect(await screen.findByText('Paused')).toBeInTheDocument()
    expect((await db.fixedExpenses.toArray())[0]!.isPaused).toBe(true)
  })

  it('adds a monthly bonus as recurring income, kept apart from fixed costs', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add recurring income' }))
    const dialog = await screen.findByRole('dialog', { name: 'New recurring income' })
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Monthly bonus' } })
    fireEvent.change(within(dialog).getByLabelText('Amount per month'), { target: { value: '3000' } })
    fireEvent.change(within(dialog).getByLabelText('Arrives on'), { target: { value: '20' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    const section = (await screen.findByRole('heading', { name: 'Recurring income' })).closest('section')!
    expect(await within(section).findByText('Monthly bonus')).toBeInTheDocument()
    expect(within(section).getByText('Next 20 Nov')).toBeInTheDocument()
    expect(within(section).getByText('+₹3,000.00')).toBeInTheDocument()
    expect(screen.getByText('No fixed expenses')).toBeInTheDocument() // not counted as a fixed cost
    expect((await db.fixedExpenses.toArray())[0]).toMatchObject({ direction: 'in', categoryId: 'income-bonus' })
  })

  it('warns when fixed costs exceed salary', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add fixed expense' }))
    await fillFixed('Rent', '60000', '25')
    expect(await screen.findByRole('alert')).toHaveTextContent('more than your salary')
  })
})

describe('new cycle salary confirmation', () => {
  it('asks to confirm the carried-over salary and saves an edit', async () => {
    // Onboard two months ago so opening today rolls into an unconfirmed cycle.
    const now = new Date()
    const past = todayISO(new Date(now.getFullYear(), now.getMonth() - 2, 15))
    await onboard({ salary: 5000000, payDay: 1, today: past }, db)

    render(<App />)
    const form = await screen.findByRole('form', { name: 'Confirm salary' })
    const input = within(form).getByLabelText('Salary this cycle')
    expect(input).toHaveValue('50000')
    fireEvent.change(input, { target: { value: '55000' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(screen.queryByRole('form', { name: 'Confirm salary' })).not.toBeInTheDocument())
    const current = await ensureCurrentCycle(todayISO(), db)
    expect(current).toMatchObject({ salary: 5500000, salaryConfirmed: true })
    expect((await db.users.get('me'))!.defaultSalary).toBe(5500000)
  })
})
