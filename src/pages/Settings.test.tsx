import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { createBackup } from '../db/backup'
import { onboard } from '../db/cycles'
import { db } from '../db/db'
import { addExpense } from '../db/transactions'

const reload = vi.fn()

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0)) // 10 Nov 2026
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, hash: '#/settings', reload } })
  reload.mockReset()
  await db.delete()
  await db.open()
  await onboard({ salary: 5000000, payDay: 1, today: '2026-11-10' }, db)
})
afterEach(() => {
  vi.useRealTimers()
})

function section(name: string) {
  return screen.getByRole('heading', { name }).closest('section')!
}

describe('settings', () => {
  it('updates the salary for this and future cycles', async () => {
    render(<App />)
    const input = await screen.findByLabelText('Salary (in-hand)')
    fireEvent.change(input, { target: { value: '55000' } })
    fireEvent.click(within(section('Salary & pay cycle')).getAllByRole('button', { name: 'Save' })[0]!)
    await waitFor(async () => expect((await db.users.get('me'))!.defaultSalary).toBe(5500000))
  })

  it('previews and applies a pay day change', async () => {
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Salary arrives on'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    const confirm = screen.getByRole('group', { name: 'Confirm pay day change' })
    expect(confirm).toHaveTextContent('This cycle will end early until 24 Nov 2026')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Change pay day' }))
    await waitFor(async () => expect((await db.users.get('me'))!.payDay).toBe(25))
    expect((await db.cycles.toArray())[0]!.end).toBe('2026-11-24')
  })

  it('shows the default categories', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Categories' })
    expect((await within(section('Categories')).findAllByRole('listitem')).map((li) => li.textContent)).toEqual([
      'Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other',
    ])
  })

  it('rejects a bad backup file and restores a good one after confirmation', async () => {
    await addExpense({ amount: 24000, categoryId: 'food', date: '2026-11-09' }, '2026-11-10', db)
    const backup = JSON.stringify(await createBackup(db))
    await db.transactions.clear()

    render(<App />)
    const input = await screen.findByLabelText('Backup file')
    fireEvent.change(input, { target: { files: [new File(['{"app":"nope"}'], 'x.json')] } })
    expect(await screen.findByText(/not from this app/)).toHaveAttribute('role', 'alert')

    fireEvent.change(input, { target: { files: [new File([backup], 'b.json')] } })
    const confirm = await screen.findByRole('group', { name: 'Confirm restore' })
    expect(confirm).toHaveTextContent('1 transactions')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Replace and restore' }))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(await db.transactions.count()).toBe(1)
  })

  it('deletes all data after confirmation', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete all data' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm delete all' })).getByRole('button', { name: 'Delete everything' }))
    await waitFor(() => expect(reload).toHaveBeenCalled())
    expect(await db.users.count()).toBe(0)
  })
})
