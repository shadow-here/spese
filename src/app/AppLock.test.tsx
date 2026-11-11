import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { onboard } from '../db/cycles'
import { db } from '../db/db'
import { enableLock } from '../db/lock'
import { todayISO } from '../lib/date'

beforeEach(async () => {
  window.location.hash = ''
  await db.delete()
  await db.open()
  await onboard({ salary: 5000000, payDay: 1, today: todayISO() }, db)
})

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

const typePin = (pin: string) => {
  for (const d of pin) fireEvent.click(screen.getByRole('button', { name: d }))
}

describe('app lock', () => {
  it('shows nothing but the lock screen until the right PIN', async () => {
    await enableLock('2580', db, 1000)
    render(<App />)
    expect(await screen.findByRole('dialog', { name: 'Spese is locked' })).toBeInTheDocument()
    expect(screen.queryByText('₹50,000.00')).not.toBeInTheDocument() // balance not rendered behind it

    typePin('1111')
    expect(await screen.findByText('Wrong PIN')).toBeInTheDocument()
    typePin('2580')
    expect(await screen.findByText('₹50,000.00')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Spese is locked' })).not.toBeInTheDocument()
  })

  it('keeps every digit when keys arrive faster than the screen updates', async () => {
    await enableLock('2580', db, 1000)
    render(<App />)
    await screen.findByRole('dialog', { name: 'Spese is locked' })
    // All four in one go, with no re-render in between.
    act(() => {
      for (const k of '2580') document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
    })
    expect(await screen.findByText('₹50,000.00')).toBeInTheDocument()
  })

  it('pauses entry after five wrong PINs', async () => {
    await enableLock('2580', db, 1000)
    render(<App />)
    await screen.findByRole('dialog', { name: 'Spese is locked' })
    for (let i = 0; i < 5; i++) {
      typePin('0000')
      await screen.findByText(i === 4 ? /Too many tries/ : 'Wrong PIN')
    }
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
  })

  it('locks again only after more than a minute away, and hides the screen while away', async () => {
    await enableLock('2580', db, 1000)
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    render(<App />)
    await screen.findByRole('dialog', { name: 'Spese is locked' })
    typePin('2580')
    await screen.findByText('₹50,000.00')

    setVisibility('hidden')
    expect(document.querySelector('.z-\\[79\\]')).not.toBeNull() // privacy shield covers the app
    now += 30_000 // quick trip to a UPI app
    setVisibility('visible')
    expect(screen.queryByRole('dialog', { name: 'Spese is locked' })).not.toBeInTheDocument()

    setVisibility('hidden')
    now += 61_000
    setVisibility('visible')
    expect(await screen.findByRole('dialog', { name: 'Spese is locked' })).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('turns on from Settings without locking you out on the spot', async () => {
    window.location.hash = '#/settings'
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on app lock' }))
    const form = screen.getByRole('form', { name: 'Turn on' })
    fireEvent.change(within(form).getByLabelText(/New PIN/), { target: { value: '2580' } })
    fireEvent.change(within(form).getByLabelText('Repeat new PIN'), { target: { value: '2581' } })
    fireEvent.submit(form)
    expect(await within(form).findByText('The two PINs don’t match')).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Repeat new PIN'), { target: { value: '2580' } })
    fireEvent.submit(form)
    await waitFor(async () => expect((await db.users.get('me'))!.lock?.pinLength).toBe(4))
    expect(screen.queryByRole('dialog', { name: 'Spese is locked' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Change PIN' })).toBeInTheDocument()
  })
})
