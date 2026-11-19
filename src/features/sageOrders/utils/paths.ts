/** The Sage orders page. */
export const LIST_PATH = '/sage/orders'

/**
 * The customer's own page, by the Sage account reference: `/sage/orders/customer/<ref>` — **in this same
 * page as a tab of its own**, showing the Sage customer's details page (Sage 50 → Customers).
 */
export const customerPath = (accountRef: string) =>
  `${LIST_PATH}/customer/${encodeURIComponent(accountRef)}`

/** The invoice raised for an order (Sage 50 → Invoices), by its number. */
export const invoicePath = (number: string) =>
  `/sage/invoices/${encodeURIComponent(number)}`
