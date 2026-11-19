import type { Invoice } from '../../../lib/api/invoices.ts'

/** The invoices page; an invoice and a customer open in this same page, as a product does. */
export const LIST_PATH = '/sage/invoices'

/**
 * One invoice's page: `/sage/invoices/<number>` (with its document type, because a credit note
 * and an invoice can share a number). Null for an invoice that has no number to open it by.
 */
export function invoicePath(invoice: Pick<Invoice, 'number' | 'kind'>): string | null {
  if (!invoice.number) return null
  const kind = invoice.kind ? `?kind=${encodeURIComponent(invoice.kind)}` : ''
  return `${LIST_PATH}/${encodeURIComponent(invoice.number)}${kind}`
}

/**
 * One customer's page, by the Sage account reference: `/sage/invoices/customer/<ref>` — **in this same
 * page as a tab of its own**, showing the Sage customer's details page (Sage 50 → Customers).
 */
export const customerPath = (accountRef: string) =>
  `${LIST_PATH}/customer/${encodeURIComponent(accountRef)}`
