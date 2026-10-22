import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { OrderListItem } from '../../../lib/api/endpoints.ts'
import { formatDate, formatDateTime, formatPrice } from '../../../lib/format.ts'
import {
  financialTone,
  fulfillmentTone,
  hasRefund,
  humanize,
  orderLabel,
  orderCustomerName,
  orderEmail,
  sourceLabel,
} from '../utils/format.ts'

const TH_BASE =
  'text-text-muted border-border bg-accent-tint/60 sticky top-0 z-[1] border-b px-3 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TD = 'overflow-hidden px-3 py-2.5 text-left align-middle'
// Wide-screen-only columns, so the table rarely needs to scroll sideways.
const FROM_2XL = 'hidden 2xl:table-cell'
const SKELETON_ROWS = 8

interface OrdersListProps {
  items: OrderListItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
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

/** The first product of the order, and how many more lines it has. */
function previewText(order: OrderListItem): string {
  const [first, ...rest] = order.line_items_preview
  if (!first) return ''
  return rest.length > 0 ? `${first} +${rest.length} more` : first
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
 * window is narrower than its columns — and cards below that. Handles the loading
 * skeleton, error and empty states itself so the page only passes data in.
 */
export function OrdersList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
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
              <li
                key={order.id}
                className="border-border bg-bg flex min-w-0 flex-col gap-1.5 rounded-xl border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[0.92rem] font-semibold">
                    {orderLabel(order)}
                  </span>
                  <span className="text-[0.88rem] font-semibold">
                    {formatPrice(order.total_price, order.currency)}
                  </span>
                </div>
                <span className="truncate text-[0.82rem]">
                  {orderCustomerName(order)}
                </span>
                <span className="text-text-muted text-[0.78rem]">
                  {dateOrDash(order.shopify_created_at)} · {itemsLabel(order)}
                  {order.shop?.name ? ` · ${order.shop.name}` : ''}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadges order={order} />
                </span>
                {previewText(order) && (
                  <span className="text-text-muted truncate text-[0.78rem]">
                    {previewText(order)}
                  </span>
                )}
              </li>
            ))}
      </ul>
    )
  }

  return (
    <div aria-busy={isPending || isStale} className="min-h-0 flex-1 overflow-auto">
      <table
        className={`w-full min-w-[880px] table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={`${TH} w-44`}>Order</th>
            <th className={`${TH} w-28`}>Date</th>
            <th className={TH}>Customer</th>
            <th className={`${TH} w-40`}>Payment</th>
            <th className={`${TH} w-36`}>Fulfillment</th>
            <th className={`${TH_RIGHT} w-32`}>Total</th>
            <th className={`${TH} w-36 ${FROM_2XL}`}>Store</th>
            <th className={`${TH} w-32 ${FROM_2XL}`}>Source</th>
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
                  {Array.from({ length: 6 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((order) => {
                const preview = previewText(order)
                const email = orderEmail(order)
                const name = orderCustomerName(order)
                return (
                  <tr
                    key={order.id}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                  >
                    <td className={TD}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">
                          {orderLabel(order)}
                        </span>
                        {preview && (
                          <span
                            className="text-text-muted truncate text-[0.78rem]"
                            title={order.line_items_preview.join(', ')}
                          >
                            {preview}
                          </span>
                        )}
                      </span>
                    </td>
                    <td
                      className={`${TD} whitespace-nowrap`}
                      title={
                        order.shopify_created_at
                          ? formatDateTime(order.shopify_created_at)
                          : undefined
                      }
                    >
                      {dateOrDash(order.shopify_created_at)}
                    </td>
                    <td className={TD}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium" title={name}>
                          {name}
                        </span>
                        {email && email !== name && (
                          <span
                            className="text-text-muted truncate text-[0.78rem]"
                            title={email}
                          >
                            {email}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={TD}>
                      <span className="flex flex-wrap items-center gap-1">
                        <Badge tone={financialTone(order.financial_status)}>
                          {humanize(order.financial_status) || '—'}
                        </Badge>
                        {order.cancelled_at && <Badge tone="danger">Cancelled</Badge>}
                      </span>
                    </td>
                    <td className={TD}>
                      <Badge tone={fulfillmentTone(order.fulfillment_status)}>
                        {humanize(order.fulfillment_status) || '—'}
                      </Badge>
                    </td>
                    <td className={`${TD} text-right`}>
                      <span
                        className="flex flex-col items-end"
                        title={order.line_items_preview.join(', ')}
                      >
                        <span className="font-semibold">
                          {formatPrice(order.total_price, order.currency)}
                        </span>
                        <span className="text-text-muted text-[0.75rem]">
                          {itemsLabel(order)}
                        </span>
                        {hasRefund(order) && (
                          <span className="text-text-muted text-[0.75rem]">
                            Refunded {formatPrice(order.total_refunded, order.currency)}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={`${TD} ${FROM_2XL}`}>
                      <span className="block truncate" title={order.shop?.name ?? ''}>
                        {order.shop?.name || '—'}
                      </span>
                    </td>
                    <td className={`${TD} ${FROM_2XL}`}>
                      <span className="block truncate">
                        {sourceLabel(order.source_name) || '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
