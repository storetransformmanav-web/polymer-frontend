/** The Sage stock page. */
export const LIST_PATH = '/sage/stock'

/**
 * One stock item's page, by its stock code: `/sage/stock/<code>` — **in this same page as a tab of its
 * own**, like a product's page, with the list kept behind it. (A code may hold a "/", so it is encoded.)
 */
export const stockPath = (stockCode: string) =>
  `${LIST_PATH}/${encodeURIComponent(stockCode)}`
