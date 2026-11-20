import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import { AlertTriangleIcon, EyeIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { ROW_ACTION, ROW_ACTION_ICON } from '../../../components/ui/rowActions.ts'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { SageOrder, SageOrderSort } from '../../../lib/api/sageOrders.ts'
import {
  SAGE_ORDER_ACTION_COLUMN_REM,
  sageOrderTableMinWidthRem,
  type SageOrderColumnDef,
} from '../utils/columns.ts'
import { count, dateText, humanize, money, statusPill } from '../utils/format.ts'
import { customerPath, invoicePath, orderPath } from '../utils/paths.ts'

// The same table text, header and cell sizes as the Orders, Products, Invoices and Sage customers
// lists. A heading and its cells share one alignment, so the two always line up.
const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-3 align-middle text-[0.7rem] font-bold leading-tight tracking-wide uppercase backdrop-blur'
const TH_ALIGN = {
  left: `${TH_BASE} text-left`,
  center: `${TH_BASE} text-center`,
  right: `${TH_BASE} text-right`,
}
const TD = 'overflow-hidden px-3 py-3 align-middle'
const TD_ALIGN = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right tabular-nums',
}
const SKELETON_ROWS = 8

interface SageOrdersListProps {
  items: SageOrder[]
  /** The columns to draw, in order. */
  columns: readonly SageOrderColumnDef[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  sort: SageOrderSort
  order: 'asc' | 'desc'
  /** A sortable heading was pressed. */
  onSort: (sort: SageOrderSort) => void
  onRetry: () => void
  onClearFilters: () => void
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

const LINK =
  'text-text hover:text-accent block max-w-full truncate no-underline hover:underline'

/** The customer's name: a link to the customer's page (Sage 50 → Customers, by account reference). */
function CustomerLink({ order }: { order: SageOrder }) {
  const { account_ref: ref, name } = order.customer
  const label = name || ref
  if (!label) return DASH
  if (!ref) return <TextCell value={label} highlight />
  return (
    <Link
      to={customerPath(ref)}
      state={{ linkedName: label }}
      className={`${LINK} font-medium`}
      title={`Open ${label}`}
    >
      <Highlight text={label} />
    </Link>
  )
}

/** The order's number: a link to the order's own page. */
function NumberLink({ order }: { order: SageOrder }) {
  if (!order.order_number) return DASH
  return (
    <Link
      to={orderPath(order.order_number)}
      state={{ linkedName: order.order_number }}
      className={`${LINK} font-semibold`}
      title={`Open order ${order.order_number}`}
    >
      <Highlight text={order.order_number} />
    </Link>
  )
}

/** The Action column's View button: opens the order's own page. */
function ViewButton({ order }: { order: SageOrder }) {
  return (
    <Link
      to={orderPath(order.order_number)}
      state={{ linkedName: order.order_number }}
      aria-label={`View order ${order.order_number}`}
      title="View"
      className={ROW_ACTION}
    >
      <EyeIcon width={ROW_ACTION_ICON} height={ROW_ACTION_ICON} />
    </Link>
  )
}

/** The invoice raised for the order: a link to its page, opened in this same page as a tab. */
function InvoiceLink({ order }: { order: SageOrder }) {
  if (!order.invoice_number) return DASH
  return (
    <Link
      to={invoicePath(order.invoice_number)}
      state={{ linkedName: order.invoice_number }}
      className={LINK}
      title={`Open invoice ${order.invoice_number}`}
    >
      <Highlight text={order.invoice_number} />
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { label, tone } = statusPill(status)
  return (
    <Badge tone={tone} className="w-[7.5rem] justify-center">
      {label}
    </Badge>
  )
}

/** What one column shows for one order. */
function ColumnCell({ column, order }: { column: SageOrderColumnDef; order: SageOrder }) {
  const cur = order.currency
  switch (column.id) {
    case 'number':
      return <NumberLink order={order} />
    case 'date':
      return <span>{dateText(order.order_date)}</span>
    case 'customer':
      return <CustomerLink order={order} />
    case 'customerOrder':
      return <TextCell value={order.customer_order_number} highlight />
    case 'status':
      return order.status ? <StatusBadge status={order.status} /> : DASH
    case 'despatchDate':
      return <span>{dateText(order.despatch_date)}</span>
    case 'net':
      return <>{money(order.net, cur)}</>
    case 'tax':
      return <>{money(order.tax, cur)}</>
    case 'gross':
      return <span className="font-semibold">{money(order.gross, cur)}</span>
    case 'invoice':
      return <InvoiceLink order={order} />
    case 'allocation':
      return <TextCell value={humanize(order.allocation_status)} />
    case 'despatchStatus':
      return <TextCell value={humanize(order.despatch_status)} />
    case 'deliveryName':
      return <TextCell value={order.delivery_name} highlight />
    case 'contact':
      return <TextCell value={order.contact_name} highlight />
    case 'takenBy':
      return <TextCell value={order.taken_by} />
    case 'carriage':
      return <>{money(order.carriage_gross, cur)}</>
    case 'prepaid':
      return <>{money(order.amount_prepaid, cur)}</>
    case 'courier':
      return <TextCell value={order.courier} />
    case 'lines':
      return <>{count(order.lines)}</>
    case 'units':
      return <>{count(order.units)}</>
    case 'unitsOutstanding':
      return <>{count(order.units_outstanding)}</>
    case 'currency':
      return <TextCell value={order.currency} />
    default:
      return null
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
 * The results area: from `lg` up a table in its own scrolling box — it takes the height the page gives
 * it, scrolls up and down under a sticky header and sideways when the window is narrower than its
 * columns — and cards below that. The columns are the ones chosen in the Columns menu, then **Action**
 * (View); the order number and View open the order's page, the customer's name the customer's and the
 * invoice number the invoice's, each in this same page as a tab. The headings of the columns
 * the API can sort by are sort buttons. Handles the loading skeleton, the error and the empty states itself.
 */
export function SageOrdersList({
  items,
  columns,
  isPending,
  error,
  hasFilters,
  isStale,
  sort,
  order,
  onSort,
  onRetry,
  onClearFilters,
}: SageOrdersListProps) {
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
          <p>
            {hasFilters
              ? 'Nothing matches the current search and filters.'
              : 'There are no orders to show yet.'}
          </p>
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
          : items.map((item) => (
              <li
                key={item.order_number}
                className="border-border bg-bg flex min-w-0 flex-col gap-1.5 rounded-xl border p-3"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.88rem] font-semibold">
                    <NumberLink order={item} />
                  </span>
                  <span className="text-[0.88rem] font-semibold">
                    {money(item.gross, item.currency)}
                  </span>
                </span>
                <span className="truncate text-[0.82rem]">
                  <CustomerLink order={item} />
                </span>
                <span className="text-text-muted text-[0.78rem]">
                  {dateText(item.order_date)} · Despatch {dateText(item.despatch_date)}
                </span>
                <span className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  {item.status ? <StatusBadge status={item.status} /> : DASH}
                  <span className="text-text-muted text-[0.78rem]">
                    {item.invoice_number
                      ? `Invoice ${item.invoice_number}`
                      : 'Not invoiced'}
                  </span>
                </span>
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
        style={{ minWidth: `${sageOrderTableMinWidthRem(columns)}rem` }}
        className={`w-full table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            {columns.map((column) => {
              const active = column.sort !== undefined && column.sort === sort
              return (
                <th
                  key={column.id}
                  style={{ width: `${column.width}rem` }}
                  className={TH_ALIGN[column.align]}
                  aria-sort={column.sort ? ariaSort(active, order) : undefined}
                >
                  {column.sort ? (
                    <SortButton
                      label={column.label}
                      active={active}
                      order={order}
                      onClick={() => onSort(column.sort as SageOrderSort)}
                    />
                  ) : (
                    column.label
                  )}
                </th>
              )
            })}
            <th
              className={TH_ALIGN.center}
              style={{ width: `${SAGE_ORDER_ACTION_COLUMN_REM}rem` }}
            >
              Action
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
                  {Array.from({ length: columns.length + 1 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((item) => (
                <tr
                  key={item.order_number}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`${TD} whitespace-nowrap ${TD_ALIGN[column.align]}`}
                    >
                      <ColumnCell column={column} order={item} />
                    </td>
                  ))}
                  <td className={`${TD} text-center`}>
                    <ViewButton order={item} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
