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

  it('adds a category with an icon and colour, and it appears in the add sheet', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Categories' })
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    const dialog = await screen.findByRole('dialog', { name: 'New category' })
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Groceries' } })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'shopping cart' }))
    await waitFor(() => expect(within(dialog).getByRole('radio', { name: /^Red/ })).toHaveAttribute('aria-checked', 'true')) // first free colour
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(async () => expect((await db.categories.orderBy('order').last())!.name).toBe('Groceries'))
    fireEvent.keyDown(document, { key: 'n' })
    const add = await screen.findByRole('dialog', { name: 'New expense' })
    expect(await within(add).findByRole('button', { name: 'Groceries' })).toBeInTheDocument()
  })

  it('sets and clears a category budget, and sets a savings goal', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Categories' })
    fireEvent.click(await within(section('Categories')).findByRole('button', { name: 'Food' }))
    let dialog = await screen.findByRole('dialog', { name: 'Edit category' })
    fireEvent.change(within(dialog).getByLabelText('Budget per pay cycle (optional)'), { target: { value: '6000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await db.categories.get('food'))!.monthlyLimit).toBe(600000))

    fireEvent.click(await within(section('Categories')).findByRole('button', { name: 'Food' }))
    dialog = await screen.findByRole('dialog', { name: 'Edit category' })
    const budget = within(dialog).getByLabelText('Budget per pay cycle (optional)')
    expect(budget).toHaveValue('6000')
    fireEvent.change(budget, { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await db.categories.get('food'))!.monthlyLimit).toBeUndefined())

    fireEvent.change(screen.getByLabelText('Savings goal per cycle (optional)'), { target: { value: '10000' } })
    fireEvent.click(within(screen.getByLabelText('Savings goal per cycle (optional)').closest('form')!).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await db.users.get('me'))!.savingsGoal).toBe(1000000))
  })

  it('renames Other but offers no Remove for it', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Categories' })
    fireEvent.click(await within(section('Categories')).findByRole('button', { name: 'Other' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit category' })
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Misc' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await db.categories.get('other'))!.name).toBe('Misc'))
  })

  it('reorders with the arrows', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Move Transport up' }))
    await waitFor(async () => expect((await db.categories.orderBy('order').first())!.id).toBe('transport'))
    expect(screen.getByRole('button', { name: 'Move Transport up' })).toBeDisabled()
  })

  it('removes a category after choosing where its entries go', async () => {
    await addExpense({ amount: 24000, categoryId: 'entertainment', date: '2026-11-09' }, '2026-11-10', db)
    render(<App />)
    await screen.findByRole('heading', { name: 'Categories' })
    fireEvent.click(await within(section('Categories')).findByRole('button', { name: 'Entertainment' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit category' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    const confirm = await within(dialog).findByRole('group', { name: 'Confirm remove' })
    expect(confirm).toHaveTextContent('Entertainment is used by 1 entry. Move them to:')
    fireEvent.change(within(confirm).getByLabelText('Move to'), { target: { value: 'shopping' } })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Move and remove' }))

    await waitFor(async () => expect(await db.categories.get('entertainment')).toBeUndefined())
    expect((await db.transactions.toArray())[0]!.categoryId).toBe('shopping')
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
