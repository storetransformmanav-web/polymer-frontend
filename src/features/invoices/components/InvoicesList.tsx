import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import { AlertTriangleIcon, EyeIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { ROW_ACTION, ROW_ACTION_ICON } from '../../../components/ui/rowActions.ts'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { Invoice, InvoiceSort } from '../../../lib/api/invoices.ts'
import {
  INVOICE_ACTION_COLUMN_REM,
  invoiceTableMinWidthRem,
  type InvoiceColumnDef,
} from '../utils/columns.ts'
import { dateText, kindLabel, money, paymentLabel, paymentTone } from '../utils/format.ts'
import { customerPath, invoicePath } from '../utils/paths.ts'

// The same table text, header and cell sizes as the Orders and Products lists. A heading and its
// cells share one alignment, so the two always line up.
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

interface InvoicesListProps {
  items: Invoice[]
  /** The columns to draw between the first and the Action column, in order. */
  columns: readonly InvoiceColumnDef[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  sort: InvoiceSort
  order: 'asc' | 'desc'
  /** A sortable heading was pressed. */
  onSort: (sort: InvoiceSort) => void
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

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={paymentTone(status)} className="w-[6.5rem] justify-center">
      {paymentLabel(status)}
    </Badge>
  )
}

const LINK =
  'text-text hover:text-accent block max-w-full truncate no-underline hover:underline'

/** The invoice's number: a link to its own page when it has one to open by. */
function NumberLink({ invoice }: { invoice: Invoice }) {
  const to = invoicePath(invoice)
  if (!to) return <TextCell value={invoice.number} highlight />
  return (
    <Link
      to={to}
      state={{ linkedName: invoice.number }}
      className={`${LINK} font-semibold`}
      title={`Open invoice ${invoice.number}`}
    >
      <Highlight text={invoice.number} />
    </Link>
  )
}

/** The customer's name: a link to the customer's page (by account reference) when it has one. */
function CustomerLink({ invoice }: { invoice: Invoice }) {
  if (!invoice.accountRef) return <TextCell value={invoice.customerName} highlight />
  return (
    <Link
      to={customerPath(invoice.accountRef)}
      state={{ linkedName: invoice.customerName || invoice.accountRef }}
      className={`${LINK} font-medium`}
      title={`Open ${invoice.customerName || invoice.accountRef}`}
    >
      <Highlight text={invoice.customerName || invoice.accountRef} />
    </Link>
  )
}

/** What one column shows for one invoice. */
function ColumnCell({ column, invoice }: { column: InvoiceColumnDef; invoice: Invoice }) {
  const overdue = invoice.paymentStatus === 'overdue'
  switch (column.id) {
    case 'customerOrder':
      return <TextCell value={invoice.customerOrderNumber} highlight />
    case 'number':
      return invoice.number ? <NumberLink invoice={invoice} /> : DASH
    case 'date':
      return <span>{dateText(invoice.date)}</span>
    case 'due':
      return (
        <span className={overdue ? 'text-danger font-semibold' : undefined}>
          {dateText(invoice.dueDate)}
        </span>
      )
    case 'customer':
      return invoice.customerName || invoice.accountRef ? (
        <CustomerLink invoice={invoice} />
      ) : (
        DASH
      )
    case 'kind':
      return <TextCell value={invoice.kind ? kindLabel(invoice.kind) : ''} />
    case 'net':
      return <>{money(invoice.net, invoice.currency)}</>
    case 'tax':
      return <>{money(invoice.tax, invoice.currency)}</>
    case 'gross':
      return (
        <span className="font-semibold">{money(invoice.gross, invoice.currency)}</span>
      )
    case 'status':
      return invoice.paymentStatus ? <StatusBadge status={invoice.paymentStatus} /> : DASH
    case 'salesOrder':
      return <TextCell value={invoice.salesOrderNumber} highlight />
    case 'takenBy':
      return <TextCell value={invoice.takenBy} />
    case 'account':
      return <TextCell value={invoice.accountRef} highlight />
    case 'paid':
      return <>{money(invoice.paid, invoice.currency)}</>
    case 'outstanding':
      return (
        <span
          className={
            overdue
              ? 'text-danger font-semibold'
              : (invoice.outstanding ?? 0) > 0
                ? 'font-semibold'
                : undefined
          }
        >
          {money(invoice.outstanding, invoice.currency)}
        </span>
      )
    default:
      return null
  }
}

/** The Action column's View button: opens the invoice's own page. */
function ViewButton({ invoice }: { invoice: Invoice }) {
  const to = invoicePath(invoice)
  if (!to) return DASH
  return (
    <Link
      to={to}
      state={{ linkedName: invoice.number }}
      aria-label={`View invoice ${invoice.number}`}
      title="View"
      className={ROW_ACTION}
    >
      <EyeIcon width={ROW_ACTION_ICON} height={ROW_ACTION_ICON} />
    </Link>
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
 * The results area: from `lg` up a table in its own scrolling box — it takes the height the page
 * gives it, scrolls up and down under a sticky header and sideways when the window is narrower than
 * its columns — and cards below that. The columns are the ones chosen in the Columns menu, then
 * **Action** (View); the customer's name opens the customer's page and the invoice's number and View
 * button open the invoice's. The headings of the columns the API can sort by are sort buttons. Handles
 * the loading skeleton, the error and the empty states itself, so the page only passes data in.
 */
export function InvoicesList({
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
}: InvoicesListProps) {
  const isTable = useMediaQuery('(min-width: 1024px)')

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load invoices</p>
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
          <p className="text-text font-semibold">No invoices found</p>
          <p>
            {hasFilters
              ? 'Nothing matches the current search and filters.'
              : 'There are no invoices to show yet.'}
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
            Loading invoices…
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
          : items.map((invoice) => (
              <li
                key={invoice.id}
                className="border-border bg-bg flex min-w-0 flex-col gap-1.5 rounded-xl border p-3"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.88rem] font-semibold">
                    {invoice.number ? <NumberLink invoice={invoice} /> : '—'}
                  </span>
                  <span className="text-[0.88rem] font-semibold">
                    {money(invoice.gross, invoice.currency)}
                  </span>
                </span>
                <span className="truncate text-[0.82rem]">
                  {invoice.customerName || invoice.accountRef ? (
                    <CustomerLink invoice={invoice} />
                  ) : (
                    '—'
                  )}
                </span>
                <span className="text-text-muted text-[0.78rem]">
                  {invoice.kind ? kindLabel(invoice.kind) : 'Document'} ·{' '}
                  {dateText(invoice.date)} · Due {dateText(invoice.dueDate)}
                </span>
                <span className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  {invoice.paymentStatus ? (
                    <StatusBadge status={invoice.paymentStatus} />
                  ) : (
                    DASH
                  )}
                  <span className="text-text-muted text-[0.78rem]">
                    Outstanding {money(invoice.outstanding, invoice.currency)}
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
        style={{ minWidth: `${invoiceTableMinWidthRem(columns)}rem` }}
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
                      onClick={() => onSort(column.sort as InvoiceSort)}
                    />
                  ) : (
                    column.label
                  )}
                </th>
              )
            })}
            <th
              className={TH_ALIGN.center}
              style={{ width: `${INVOICE_ACTION_COLUMN_REM}rem` }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {isPending && (
            <tr className="sr-only">
              <td role="status">Loading invoices…</td>
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
            : items.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`${TD} whitespace-nowrap ${TD_ALIGN[column.align]}`}
                    >
                      <ColumnCell column={column} invoice={invoice} />
                    </td>
                  ))}
                  <td className={`${TD} text-center`}>
                    <ViewButton invoice={invoice} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
