import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { UpdatePrompt } from './UpdatePrompt'

const updateServiceWorker = vi.fn(async () => {})
let ready = false

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: useState(ready),
    offlineReady: useState(false),
    updateServiceWorker,
  }),
}))

beforeEach(() => {
  updateServiceWorker.mockClear()
})

describe('UpdatePrompt', () => {
  it('shows nothing when no update is waiting', () => {
    ready = false
    render(<UpdatePrompt />)
    expect(screen.queryByText(/new version/)).not.toBeInTheDocument()
  })

  it('offers Reload; with no waiting worker it falls back to a plain page reload', () => {
    ready = true
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
    render(<UpdatePrompt />)
    expect(screen.getByRole('status')).toHaveTextContent('A new version of Spese is ready')
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalled()
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  })

  it('can be dismissed with Later without updating', () => {
    ready = true
    render(<UpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByText(/new version/)).not.toBeInTheDocument()
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })
})
