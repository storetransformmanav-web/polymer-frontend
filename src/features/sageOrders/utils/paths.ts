/** The Sage orders page. */
export const LIST_PATH = '/sage/orders'

/** The customer's own page (Sage 50 → Customers), by the Sage account reference. */
export const customerPath = (accountRef: string) =>
  `/sage/customers/${encodeURIComponent(accountRef)}`

/** The invoice raised for an order (Sage 50 → Invoices), by its number. */
export const invoicePath = (number: string) =>
  `/sage/invoices/${encodeURIComponent(number)}`
