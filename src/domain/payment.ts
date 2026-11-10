import type { PaymentMethod } from './types'

/** Payment method tag (PRD #25). Optional on expenses; remembered like the category. */
export const PAYMENT_METHODS: { id: PaymentMethod; name: string }[] = [
  { id: 'upi', name: 'UPI' },
  { id: 'card', name: 'Card' },
  { id: 'cash', name: 'Cash' },
  { id: 'other', name: 'Other' },
]

export function paymentMethodName(id: PaymentMethod | undefined): string | undefined {
  return PAYMENT_METHODS.find((m) => m.id === id)?.name
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return PAYMENT_METHODS.some((m) => m.id === value)
}
