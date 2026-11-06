import type { OrderDetail, OrderListItem } from '../../../lib/api/endpoints.ts'
import { humanize } from './format.ts'

type Transaction = OrderDetail['transactions'][number]

/** How it was paid: the card ("Mastercard •••• 1906"), else the kind of payment. */
function transactionMethod(transaction: Transaction): string {
  return (
    [transaction.card_brand, transaction.card_last4].filter(Boolean).join(' ') ||
    humanize(transaction.payment_method) ||
    ''
  )
}

/**
 * How the order was paid, in a few words: the methods of its payments (a refund or a failed try is
 * not a way of paying), else the gateways the list row names, which is all there is while the details load.
 */
export function orderPaymentMethod(
  order: Pick<OrderListItem, 'payment_gateway_names'> &
    Partial<Pick<OrderDetail, 'transactions'>>,
): string {
  const methods = (order.transactions ?? [])
    .filter((transaction) => !/^(refund|void)$/i.test(transaction.kind ?? ''))
    .filter((transaction) => !/^(failure|error)$/i.test(transaction.status ?? ''))
    .map(transactionMethod)
  const known = methods.length > 0 ? methods : order.payment_gateway_names.map(humanize)
  return [...new Set(known.filter(Boolean))].join(', ')
}
