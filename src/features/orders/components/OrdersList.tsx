import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLinkedState } from '../../../hooks/useLinkedState.ts'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, EyeIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { ROW_ACTION } from '../../../components/ui/rowActions.ts'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { OrderListItem } from '../../../lib/api/endpoints.ts'
import { formatDateTime, formatPrice } from '../../../lib/format.ts'
import { formatRelativeDateTime } from '../../../lib/storeTime.ts'
import {
  ORDER_ACTIONS_COLUMN_REM,
  ORDER_NUMBER_COLUMN_REM,
  orderTableMinWidthRem,
  type OrderColumnDef,
} from '../utils/columns.ts'
import {
  customerPath,
  financialTone,
  fulfillmentTone,
  humanize,
  orderCustomer,
  orderLabel,
  sourceLabel,
} from '../utils/format.ts'

const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
// No alignment here: each cell says its own (a `text-left` here would beat `text-center`).
const TD = 'overflow-hidden px-3 py-3 align-middle'
const SKELETON_ROWS = 8
// The payment pills: one width, centred in their column, so they line up.
const PILL = 'w-[9.5rem]'

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
  /** The columns to draw between Order and Actions, in order (the Columns menu's choice). */
  columns: OrderColumnDef[]
}

const dateOrDash = (value: string | null | undefined) =>
  value ? formatRelativeDateTime(value) : '—'

const itemsLabel = (order: OrderListItem) =>
  `${order.items_count.toLocaleString('en-GB')} ${order.items_count === 1 ? 'item' : 'items'}`

/**
 * Whether to show the "Cancelled" pill: when the order was cancelled — unless its payment status
 * already says so (voided or refunded), which would only be a second pill for the same thing.
 */
function showsCancelled(order: OrderListItem): boolean {
  if (!order.cancelled_at) return false
  const status = (order.financial_status ?? '').toUpperCase()
  return status !== 'VOIDED' && status !== 'REFUNDED'
}

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
      {showsCancelled(order) && <Badge tone="danger">Cancelled</Badge>}
    </>
  )
}

const DASH = <span className="text-text-muted">—</span>

/** Plain text, cut short with the whole text on hover; a dash when there is none. */
function TextCell({ value, highlight }: { value: string; highlight?: boolean }) {
  if (!value) return DASH
  return (
    <span className="block truncate" title={value}>
      {highlight ? <Highlight text={value} /> : value}
    </span>
  )
}

/** An amount in the order's own currency; a dash when the answer has none. */
const amount = (value: string | null | undefined, order: OrderListItem) =>
  value == null || value === '' ? DASH : <>{formatPrice(value, order.currency)}</>

/** A date and time as "Today at 10:37 am"…, the full date and time on hover; a dash when empty. */
function DateCell({ value }: { value: string | null | undefined }) {
  if (!value) return DASH
  return <span title={formatDateTime(value)}>{formatRelativeDateTime(value)}</span>
}

/** What one chosen column shows for one order. */
function ColumnCell({
  column,
  order,
  linkedState,
}: {
  column: OrderColumnDef
  order: OrderListItem
  linkedState: ReturnType<typeof useLinkedState>
}) {
  const name = order.customer?.full_name?.trim() ?? ''
  const email = order.customer?.email?.trim() ?? ''
  switch (column.id) {
    case 'created':
      // "Today at 10:37 am" / "Yesterday at …" / "4 Nov at 10:38 am"; the full date and time on hover.
      return <DateCell value={order.shopify_created_at} />
    case 'customer':
      return name ? (
        // The name, with a small copy icon always visible beside it — the same button and 20px box
        // as the product name's on the Products page.
        <span className="flex min-w-0 items-center gap-1.5">
          {customerPath(order) ? (
            // A customer in the CRM: their name opens their details in this page.
            <Link
              to={customerPath(order) as string}
              state={linkedState(name)}
              title={`Open ${name}`}
              className="text-text hover:text-accent min-w-0 truncate font-medium hover:underline"
            >
              <Highlight text={name} />
            </Link>
          ) : (
            <span className="min-w-0 truncate" title={name}>
              <Highlight text={name} />
            </span>
          )}
          <span className="flex h-5 shrink-0 items-center">
            <CopyButton value={name} label={`Copy customer name ${name}`} />
          </span>
        </span>
      ) : (
        DASH
      )
    case 'email':
      return <TextCell value={email} highlight />
    case 'payment_status':
      return (
        <span className="flex flex-col items-center gap-1">
          <Badge tone={financialTone(order.financial_status)} className={PILL}>
            {humanize(order.financial_status) || '—'}
          </Badge>
          {showsCancelled(order) && (
            <Badge tone="danger" className={PILL}>
              Cancelled
            </Badge>
          )}
        </span>
      )
    case 'fulfillment_status':
      return (
        <Badge tone={fulfillmentTone(order.fulfillment_status)} className={PILL}>
          {humanize(order.fulfillment_status) || '—'}
        </Badge>
      )
    case 'items':
      return <>{order.items_count.toLocaleString('en-GB')}</>
    case 'total':
      return (
        <span className="font-semibold">
          {formatPrice(order.total_price, order.currency)}
        </span>
      )
    case 'store':
      return <TextCell value={order.shop?.name?.trim() ?? ''} />
    case 'channel':
      return <TextCell value={sourceLabel(order.source_name)} />
    case 'payment_method':
      return <TextCell value={order.payment_gateway_names.map(humanize).join(', ')} />
    case 'tags':
      return <TextCell value={order.tags.join(', ')} />
    case 'products':
      return <TextCell value={order.line_items_preview.join(', ')} />
    case 'return_status':
      return <TextCell value={humanize(order.return_status)} />
    case 'phone':
      return <TextCell value={order.customer?.phone?.trim() ?? ''} />
    case 'subtotal':
      return amount(order.subtotal_price, order)
    case 'discounts':
      return amount(order.total_discounts, order)
    case 'shipping':
      return amount(order.total_shipping, order)
    case 'tax':
      return amount(order.total_tax, order)
    case 'refunded':
      return amount(order.total_refunded, order)
    case 'net_payment':
      return amount(order.net_payment, order)
    case 'updated':
      return <DateCell value={order.shopify_updated_at} />
    case 'closed':
      return <DateCell value={order.closed_at} />
    case 'cancelled':
      return <DateCell value={order.cancelled_at} />
  }
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
 * number, the customer's name and email, the financial and
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
  columns,
}: OrdersListProps) {
  const linkedState = useLinkedState()
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
                    <span className="text-[0.88rem] font-semibold">
                      <Highlight text={orderLabel(order)} />
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
    <div
      aria-busy={isPending || isStale}
      className="relative min-h-0 flex-1 overflow-auto"
    >
      <table
        style={{ minWidth: `${orderTableMinWidthRem(columns)}rem` }}
        className={`w-full table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={TH} style={{ width: `${ORDER_NUMBER_COLUMN_REM}rem` }}>
              Order
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                style={{ width: `${column.width}rem` }}
                className={
                  column.align === 'right'
                    ? TH_RIGHT
                    : column.align === 'center'
                      ? TH_CENTER
                      : TH
                }
              >
                {column.label}
              </th>
            ))}
            <th className={TH_CENTER} style={{ width: `${ORDER_ACTIONS_COLUMN_REM}rem` }}>
              Actions
            </th>
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
                  {Array.from({ length: columns.length + 2 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((order) => (
                <tr
                  key={order.id}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  <td className={TD}>
                    {/* The order number opens the order, like the eye button does. */}
                    <button
                      type="button"
                      title={`Open order ${orderLabel(order)}`}
                      onClick={() => onOpen(order)}
                      onPointerEnter={() => onPrefetch(order)}
                      onFocus={() => onPrefetch(order)}
                      className="text-text hover:text-accent block max-w-full cursor-pointer truncate border-none bg-transparent p-0 text-left font-semibold hover:underline"
                    >
                      <Highlight text={orderLabel(order)} />
                    </button>
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`${TD} whitespace-nowrap ${
                        column.align === 'right'
                          ? 'text-right tabular-nums'
                          : column.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      }`}
                    >
                      <ColumnCell
                        column={column}
                        order={order}
                        linkedState={linkedState}
                      />
                    </td>
                  ))}
                  <td className={`${TD} text-center`}>
                    <button
                      type="button"
                      aria-label={`View order ${orderLabel(order)}`}
                      title="View"
                      onClick={() => onOpen(order)}
                      onPointerEnter={() => onPrefetch(order)}
                      onFocus={() => onPrefetch(order)}
                      className={ROW_ACTION}
                    >
                      <EyeIcon />
                    </button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
