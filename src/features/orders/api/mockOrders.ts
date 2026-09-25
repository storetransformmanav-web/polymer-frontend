import { orderSchema, type Order, type OrderCustomer } from '../schemas/order.ts'

export type {
  CustomerType,
  FinancialStatus,
  FulfillmentStatus,
  Order,
  OrderCustomer,
} from '../schemas/order.ts'

/**
 * Mock order data, shaped after the fields this app will eventually
 * sync from the client's Shopify store (order name, financial/
 * fulfillment status, line item count, totals in the store's
 * currency).
 *
 * TODO: this app doesn't talk to Shopify directly from the browser —
 * Shopify Admin API credentials belong on a backend. Once that sync
 * exists, replace `getOrders` with a call through
 * src/lib/api/client.ts to our own backend (which in turn syncs with
 * Shopify), keeping this same return shape so OrdersPage/useOrders
 * don't need to change. Validate that response with
 * `orderSchema.array().parse(response)` before returning it.
 */

const CUSTOMERS: OrderCustomer[] = [
  { name: 'Green Leaf Café', type: 'wholesale' },
  { name: 'Riverside Bakery', type: 'wholesale' },
  { name: 'The Corner Deli', type: 'retail' },
  { name: 'Urban Coffee Co.', type: 'wholesale' },
  { name: 'Bright Bites Catering', type: 'wholesale' },
  { name: 'Pantry & Co.', type: 'retail' },
  { name: 'Harbourside Fish Bar', type: 'retail' },
  { name: 'The Daily Grind', type: 'wholesale' },
]

const FINANCIAL_STATUSES: Order['financialStatus'][] = ['paid', 'pending', 'refunded']
const FULFILLMENT_STATUSES: Order['fulfillmentStatus'][] = [
  'fulfilled',
  'unfulfilled',
  'partial',
]

function buildOrder(index: number): Order {
  const customer = CUSTOMERS[index % CUSTOMERS.length]
  const financialStatus = FINANCIAL_STATUSES[index % FINANCIAL_STATUSES.length]
  const fulfillmentStatus =
    FULFILLMENT_STATUSES[(index + 1) % FULFILLMENT_STATUSES.length]
  const daysAgo = index * 2 + 1

  return {
    id: `order-${index + 1}`,
    orderNumber: `#${1040 + index}`,
    customer,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    financialStatus,
    fulfillmentStatus,
    lineItemCount: (index % 5) + 1,
    total: 84.5 + index * 37.25,
    currency: 'GBP',
  }
}

const MOCK_ORDERS: Order[] = orderSchema
  .array()
  .parse(Array.from({ length: 12 }, (_, index) => buildOrder(index)))

/**
 * Resolves with mock orders after a short simulated delay, so callers
 * exercise real loading states even though there's no network call
 * yet.
 */
export function getOrders(): Promise<Order[]> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(MOCK_ORDERS), 350)
  })
}
