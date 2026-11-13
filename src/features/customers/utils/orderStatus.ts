import type { BadgeTone } from '../../../components/ui/Badge.tsx'

/** How a payment status (Shopify's `financial_status`) reads: paid is good, owed is a warning. */
export function paymentTone(status: string | null | undefined): BadgeTone {
  switch ((status ?? '').toUpperCase()) {
    case 'PAID':
      return 'success'
    case 'PENDING':
    case 'AUTHORIZED':
    case 'PARTIALLY_PAID':
      return 'warning'
    case 'VOIDED':
    case 'EXPIRED':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** How a fulfillment status reads: fulfilled is good, waiting is a warning. */
export function fulfillmentTone(status: string | null | undefined): BadgeTone {
  switch ((status ?? '').toUpperCase()) {
    case 'FULFILLED':
      return 'success'
    case 'UNFULFILLED':
    case 'PARTIALLY_FULFILLED':
    case 'PARTIAL':
    case 'IN_PROGRESS':
      return 'warning'
    default:
      return 'neutral'
  }
}
