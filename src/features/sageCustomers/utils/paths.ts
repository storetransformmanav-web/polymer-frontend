/** The Sage customers page; one customer opens in this same page, as a tab of its own. */
export const LIST_PATH = '/sage/customers'

/** One customer's page, by the Sage account reference: `/sage/customers/<ref>`. */
export const customerPath = (accountRef: string) =>
  `${LIST_PATH}/${encodeURIComponent(accountRef)}`

/** The matching CRM (Shopify) customer's own page — opened by its CRM id. */
export const crmCustomerPath = (id: string) => `/customers/${encodeURIComponent(id)}`

/**
 * An invoice's page, **in this same page as a tab of its own** (`/sage/customers/invoice/<number>`, with
 * its document type when it has one) — it opens beside the customer's tab instead of leaving.
 */
export function invoicePath(number: string, kind: string): string {
  const type = kind ? `?kind=${encodeURIComponent(kind)}` : ''
  return `${LIST_PATH}/invoice/${encodeURIComponent(number)}${type}`
}
