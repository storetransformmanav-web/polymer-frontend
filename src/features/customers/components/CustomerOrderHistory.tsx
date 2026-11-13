import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, EyeIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ROW_ACTION } from '../../../components/ui/rowActions.ts'
import { formatDateTimeAmPm, formatPrice } from '../../../lib/format.ts'
import type { CustomerDetail, OrderListItem } from '../../../lib/api/endpoints.ts'
import { OrderDetailsView } from '../../orders/index.ts'
import { useCustomerOrderHistory } from '../hooks/useCustomerOrders.ts'
import { humanize } from '../utils/format.ts'
import { paymentTone } from '../utils/orderStatus.ts'

// The same table as the Orders list: a tinted sticky header (0.7rem bold capitals), 0.85rem cells
// with `px-3 py-3`, striped rows tinted on hover, and a 28px eye button at the end of the row.
const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'overflow-hidden px-3 py-3 align-middle'
const RETRY =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border px-3 text-[0.8rem] font-semibold transition-colors'

const PAGE_SIZE = 10
const COLUMNS = 6
/** The width of the Actions column, as in the Orders list (just the eye). */
const ACTIONS_COLUMN_REM = 5

/** What the history hands to the page when an order is opened (the page makes it a tab). */
export interface OpenOrderRequest {
  /** The order number, which opens it. */
  ref: string
  label: string
  shop: string | null
}

/** The order number as the Orders list writes it: 17516, not "#17516". */
const orderNumber = (order: OrderListItem) => String(order.order_number ?? order.name)

/**
 * The customer's **Orders** tab: their order history, newest first, in the Orders list's table —
 * Order ID, order date with the time (AM/PM), items, payment status, total price and an eye. The
 * eye (or the order number) opens the **order's own page in place of this table**, on the same
 * customer page — the way a customer's page opens from the customers list — and its Back button
 * returns to the history (on the page it was left on). The table scrolls in its own box with a
 * sticky header; the page controls are the list's footer.
 */
export function CustomerOrderHistory({
  customer,
  onOpenOrder,
}: {
  customer: CustomerDetail
  /**
   * Opens an order as a tab beside the customer's (the Customers page). Without it (the customer
   * is being looked at from an order) the order opens in place of this table instead.
   */
  onOpenOrder?: (order: OpenOrderRequest) => void
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [viewing, setViewing] = useState<OrderListItem | null>(null)
  const history = useCustomerOrderHistory(customer, page, pageSize, viewing === null)
  const shop = customer.shop?.key ?? null
  const data = history.data

  function open(order: OrderListItem) {
    if (onOpenOrder)
      onOpenOrder({ ref: orderNumber(order), label: orderNumber(order), shop })
    else setViewing(order)
  }

  if (viewing) {
    return (
      <div className="relative">
        <OrderDetailsView
          key={`${shop ?? ''}|${viewing.id}`}
          reference={orderNumber(viewing)}
          shop={shop}
          backLabel="Back to orders"
          onBack={() => setViewing(null)}
        />
      </div>
    )
  }

  if (history.error) {
    return (
      <div className="border-border bg-bg flex flex-col items-center gap-3 rounded-xl border px-4 py-12 text-center">
        <AlertTriangleIcon width={26} height={26} className="text-danger" />
        <p className="m-0 text-[0.9rem]">{history.error}</p>
        <button type="button" onClick={history.retry} className={RETRY}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <section
      aria-label="Order history"
      className="border-border bg-bg flex min-w-0 flex-col overflow-hidden rounded-xl border lg:min-h-0 lg:flex-1"
    >
      <div
        aria-busy={history.isPending || history.isFetching}
        className="max-h-[min(68svh,760px)] min-h-40 overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
      >
        <table className="w-full min-w-[640px] border-collapse text-[0.85rem]">
          <thead>
            <tr>
              <th className={TH}>Order ID</th>
              <th className={TH}>Order date</th>
              <th className={TH_CENTER}>Items</th>
              <th className={TH_CENTER}>Payment status</th>
              <th className={TH_RIGHT}>Total price</th>
              <th className={TH_CENTER} style={{ width: `${ACTIONS_COLUMN_REM}rem` }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {history.isPending ? (
              <tr>
                <td colSpan={COLUMNS} className="text-text-muted px-4 py-12 text-center">
                  <span
                    role="status"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <SpinnerIcon width={18} height={18} className="animate-spin" />
                    Loading orders…
                  </span>
                </td>
              </tr>
            ) : history.orders.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className="text-text-muted px-4 py-12 text-center">
                  No orders from this customer are in the CRM yet.
                </td>
              </tr>
            ) : (
              history.orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  <td className={`${TD} whitespace-nowrap`}>
                    {/* The order number opens the order, like the eye does. */}
                    <button
                      type="button"
                      title={`Open order ${orderNumber(order)}`}
                      onClick={() => open(order)}
                      className="text-text hover:text-accent cursor-pointer border-none bg-transparent p-0 text-left font-semibold hover:underline"
                    >
                      {orderNumber(order)}
                    </button>
                    {order.cancelled_at && (
                      <span className="ml-2 align-middle">
                        <Badge tone="danger">Cancelled</Badge>
                      </span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    {order.shopify_created_at ? (
                      formatDateTimeAmPm(order.shopify_created_at)
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-center tabular-nums`}>
                    {order.items_count}
                  </td>
                  <td className={`${TD} text-center`}>
                    {order.financial_status ? (
                      <Badge
                        tone={paymentTone(order.financial_status)}
                        className="w-32 justify-center"
                      >
                        {humanize(order.financial_status)}
                      </Badge>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
                    {formatPrice(order.total_price, order.currency)}
                  </td>
                  <td className={`${TD} text-center`}>
                    <button
                      type="button"
                      aria-label={`View order ${orderNumber(order)}`}
                      title="View"
                      onClick={() => open(order)}
                      className={ROW_ACTION}
                    >
                      <EyeIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <PaginationFooter
          page={data.page}
          pageSize={pageSize}
          total={data.total}
          totalPages={data.total_pages}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      )}
    </section>
  )
}
