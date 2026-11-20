/** The Sage orders page. */
export const LIST_PATH = '/sage/orders'

/**
 * One order's page, by its number: `/sage/orders/<number>` — **in this same page as a tab of its own**,
 * like a product's page, with the list kept behind it.
 */
export const orderPath = (orderNumber: string) =>
  `${LIST_PATH}/${encodeURIComponent(orderNumber)}`

/**
 * The customer's own page, by the Sage account reference: `/sage/orders/customer/<ref>` — **in this same
 * page as a tab of its own**, showing the Sage customer's details page (Sage 50 → Customers).
 */
export const customerPath = (accountRef: string) =>
  `${LIST_PATH}/customer/${encodeURIComponent(accountRef)}`

/**
 * An invoice's page, by its number: `/sage/orders/invoice/<number>` — **in this same page as a tab of its
 * own**, showing the invoice's details page (Sage 50 → Invoices) beside the order's tab.
 */
export const invoicePath = (number: string) =>
  `${LIST_PATH}/invoice/${encodeURIComponent(number)}`
