import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, EyeIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { OrderListItem } from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice } from '../../../lib/format.ts'
import {
  financialTone,
  fulfillmentTone,
  humanize,
  orderCustomer,
  orderLabel,
} from '../utils/format.ts'

const TH_BASE =
  'text-text-muted border-border bg-accent-tint/60 sticky top-0 z-[1] border-b px-3 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'overflow-hidden px-3 py-3 text-left align-middle'
const SKELETON_ROWS = 8
// The payment pills: one width, centred in their column, so they line up.
const PILL = 'w-32 justify-center'

interface OrdersListProps {
  items: OrderListItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  /** Opens an order's details page (the eye button). */
  onOpen: (order: OrderListItem) => void
  /** Hover/focus: start loading the details so opening is instant. */
  onPrefetch: (order: OrderListItem) => void
  onRetry: () => void
  onClearFilters: () => void
}

const dateOrDash = (value: string | null | undefined) => (value ? formatDate(value) : '—')

const itemsLabel = (order: OrderListItem) =>
  `${order.items_count.toLocaleString('en-GB')} ${order.items_count === 1 ? 'item' : 'items'}`

/** The order's status pills: payment, fulfillment, and "Cancelled" when it was. */
function StatusBadges({ order }: { order: OrderListItem }) {
  return (
    <>
      <Badge tone={financialTone(order.financial_status)}>
        {humanize(order.financial_status) || '—'}
      </Badge>
      <Badge tone={fulfillmentTone(order.fulfillment_status)}>
        {humanize(order.fulfillment_status) || '—'}
      </Badge>
      {order.cancelled_at && <Badge tone="danger">Cancelled</Badge>}
    </>
  )
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}

const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

/**
 * The results area: from `lg` up a table in its own scrolling box — it takes the height
 * the page gives it, scrolls up and down under a sticky header, and sideways when the
 * window is narrower than its columns — and cards below that. The table shows the order
 * number, the customer's name and email, the store, the currency, the financial and
 * fulfillment status, the item count, the total price and a **View** (eye) button. Handles the
 * loading skeleton, error and empty states itself so the page only passes data in.
 */
export function OrdersList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  onOpen,
  onPrefetch,
  onRetry,
  onClearFilters,
}: OrdersListProps) {
  const isTable = useMediaQuery('(min-width: 1024px)')

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load orders</p>
          <p>{error}</p>
        </div>
        <button type="button" className={MESSAGE_BUTTON} onClick={onRetry}>
          Try again
        </button>
      </Message>
    )
  }

  if (!isPending && items.length === 0) {
    return (
      <Message>
        <SearchIcon width={28} height={28} />
        <div>
          <p className="text-text font-semibold">No orders found</p>
          <p>Nothing matches the current search and filters.</p>
        </div>
        {hasFilters && (
          <button type="button" className={MESSAGE_BUTTON} onClick={onClearFilters}>
            Clear all filters
          </button>
        )}
      </Message>
    )
  }

  const dim = isStale ? 'opacity-60' : ''

  if (!isTable) {
    return (
      <ul
        aria-busy={isPending || isStale}
        className={`grid grid-cols-1 gap-2.5 p-3 transition-opacity duration-150 md:grid-cols-2 ${dim}`}
      >
        {isPending && (
          <li role="status" className="sr-only">
            Loading orders…
          </li>
        )}
        {isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border bg-surface h-28 animate-pulse rounded-xl border"
              />
            ))
          : items.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onOpen(order)}
                  onPointerEnter={() => onPrefetch(order)}
                  onFocus={() => onPrefetch(order)}
                  aria-label={`View order ${orderLabel(order)}`}
                  className="border-border bg-bg hover:border-accent flex w-full min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors"
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="text-[0.92rem] font-semibold">
                      {orderLabel(order)}
                    </span>
                    <span className="text-[0.88rem] font-semibold">
                      {formatPrice(order.total_price, order.currency)}
                    </span>
                  </span>
                  <span className="truncate text-[0.82rem]">
                    {orderCustomer(order)?.name ?? '—'}
                  </span>
                  <span className="text-text-muted text-[0.78rem]">
                    {dateOrDash(order.shopify_created_at)} · {itemsLabel(order)}
                    {order.shop?.name ? ` · ${order.shop.name}` : ''}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadges order={order} />
                  </span>
                </button>
              </li>
            ))}
      </ul>
    )
  }

  return (
    <div aria-busy={isPending || isStale} className="min-h-0 flex-1 overflow-auto">
      <table
        className={`w-full min-w-[1180px] table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={`${TH} w-24`}>Order</th>
            <th className={TH}>Customer name</th>
            <th className={TH}>Email</th>
            <th className={`${TH} w-44`}>Store</th>
            <th className={`${TH_CENTER} w-24`}>Currency</th>
            <th className={`${TH_CENTER} w-40`}>Financial status</th>
            <th className={`${TH_CENTER} w-40`}>Fulfillment status</th>
            <th className={`${TH_RIGHT} w-20`}>Items</th>
            <th className={`${TH_RIGHT} w-28`}>Total price</th>
            <th className={`${TH_CENTER} w-20`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isPending && (
            <tr className="sr-only">
              <td role="status">Loading orders…</td>
            </tr>
          )}
          {isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} aria-hidden="true" className="border-border border-b">
                  {Array.from({ length: 10 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((order) => {
                const name = order.customer?.full_name?.trim() ?? ''
                const email = order.customer?.email?.trim() ?? ''
                return (
                  <tr
                    key={order.id}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                  >
                    <td className={TD}>
                      <span className="block truncate font-semibold">
                        {orderLabel(order)}
                      </span>
                    </td>
                    <td className={TD}>
                      {name ? (
                        <span className="block truncate" title={name}>
                          {name}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className={TD}>
                      {email ? (
                        <span className="block truncate" title={email}>
                          {email}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className={TD}>
                      <span className="block truncate" title={order.shop?.name ?? ''}>
                        {order.shop?.name || '—'}
                      </span>
                    </td>
                    <td className={`${TD} text-center`}>{order.currency || '—'}</td>
                    <td className={`${TD} text-center`}>
                      <span className="flex flex-col items-center gap-1">
                        <Badge
                          tone={financialTone(order.financial_status)}
                          className={PILL}
                        >
                          {humanize(order.financial_status) || '—'}
                        </Badge>
                        {order.cancelled_at && (
                          <Badge tone="danger" className={PILL}>
                            Cancelled
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className={`${TD} text-center`}>
                      <Badge
                        tone={fulfillmentTone(order.fulfillment_status)}
                        className={PILL}
                      >
                        {humanize(order.fulfillment_status) || '—'}
                      </Badge>
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {order.items_count.toLocaleString('en-GB')}
                    </td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>
                      {formatPrice(order.total_price, order.currency)}
                    </td>
                    <td className={`${TD} text-center`}>
                      <button
                        type="button"
                        aria-label={`View order ${orderLabel(order)}`}
                        title="View"
                        onClick={() => onOpen(order)}
                        onPointerEnter={() => onPrefetch(order)}
                        onFocus={() => onPrefetch(order)}
                        className="text-text-muted hover:text-accent inline-flex cursor-pointer items-center justify-center border-none bg-none p-1 transition-colors"
                      >
                        <EyeIcon />
                      </button>
                    </td>
                  </tr>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
