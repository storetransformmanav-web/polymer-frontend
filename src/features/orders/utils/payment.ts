import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { humanize } from './format.ts'

type Transaction = OrderDetail['transactions'][number]

/** A transaction's status as a pill tone. */
export function transactionTone(status: string): 'success' | 'warning' | 'danger' {
  return status === 'SUCCESS' ? 'success' : status === 'PENDING' ? 'warning' : 'danger'
}

/** How it was paid: the card ("Mastercard •••• 1906"), else the kind of payment. */
export function transactionMethod(transaction: Transaction): string {
  return (
    [transaction.card_brand, transaction.card_last4].filter(Boolean).join(' ') ||
    humanize(transaction.payment_method) ||
    ''
  )
}
