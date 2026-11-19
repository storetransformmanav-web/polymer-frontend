import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import { AlertTriangleIcon, EyeIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { ROW_ACTION, ROW_ACTION_ICON } from '../../../components/ui/rowActions.ts'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { SageCustomer, SageCustomerSort } from '../../../lib/api/sageCustomers.ts'
import {
  SAGE_CUSTOMER_ACTION_COLUMN_REM,
  sageCustomerTableMinWidthRem,
  type SageCustomerColumnDef,
} from '../utils/columns.ts'
import { accountStatus, dateText, money } from '../utils/format.ts'
import { crmCustomerPath, customerPath } from '../utils/paths.ts'

// The same table text, header and cell sizes as the Orders, Products and Invoices lists. A heading
// and its cells share one alignment, so the two always line up.
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

interface SageCustomersListProps {
  items: SageCustomer[]
  /** The columns to draw between the first and the Action column, in order. */
  columns: readonly SageCustomerColumnDef[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  sort: SageCustomerSort
  order: 'asc' | 'desc'
  /** A sortable heading was pressed. */
  onSort: (sort: SageCustomerSort) => void
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

/** The customer's name: a link to the customer's own page (opened in this page as a tab). */
function NameLink({ customer }: { customer: SageCustomer }) {
  const label = customer.name || customer.account_ref
  return (
    <Link
      to={customerPath(customer.account_ref)}
      state={{ linkedName: label }}
      className={`${LINK} font-medium`}
      title={`Open ${label}`}
    >
      <Highlight text={label} />
    </Link>
  )
}

function StatusBadge({ customer }: { customer: SageCustomer }) {
  const { label, tone } = accountStatus(customer)
  return (
    <Badge tone={tone} className="w-[5.5rem] justify-center">
      {label}
    </Badge>
  )
}

/** What one column shows for one customer. */
function ColumnCell({
  column,
  customer,
}: {
  column: SageCustomerColumnDef
  customer: SageCustomer
}) {
  const cur = customer.currency
  switch (column.id) {
    case 'account':
      return customer.account_ref ? (
        <Link
          to={customerPath(customer.account_ref)}
          state={{ linkedName: customer.name || customer.account_ref }}
          className={`${LINK} font-semibold`}
          title={`Open ${customer.account_ref}`}
        >
          <Highlight text={customer.account_ref} />
        </Link>
      ) : (
        DASH
      )
    case 'name':
      return customer.name || customer.account_ref ? (
        <NameLink customer={customer} />
      ) : (
        DASH
      )
    case 'contact':
      return <TextCell value={customer.contact_name} highlight />
    case 'email':
      return <TextCell value={customer.email} highlight />
    case 'telephone':
      return <TextCell value={customer.telephone} highlight />
    case 'orders':
      return customer.crm_customer ? (
        <>{customer.crm_customer.orders_count.toLocaleString('en-GB')}</>
      ) : (
        DASH
      )
    case 'postcode':
      return <TextCell value={customer.postcode} highlight />
    case 'country':
      return <TextCell value={customer.country_code} />
    case 'currency':
      return <TextCell value={customer.currency} />
    case 'balance':
      return (
        <span
          className={
            customer.over_credit_limit
              ? 'text-danger font-semibold'
              : (customer.balance ?? 0) !== 0
                ? 'font-semibold'
                : undefined
          }
          title={customer.over_credit_limit ? 'Over the credit limit' : undefined}
        >
          {money(customer.balance, cur)}
        </span>
      )
    case 'creditLimit':
      return <>{money(customer.credit_limit, cur)}</>
    case 'availableCredit':
      return (
        <span
          className={(customer.available_credit ?? 0) < 0 ? 'text-danger' : undefined}
        >
          {money(customer.available_credit, cur)}
        </span>
      )
    case 'status':
      return <StatusBadge customer={customer} />
    case 'turnoverMtd':
      return <>{money(customer.turnover_mtd, cur)}</>
    case 'turnoverYtd':
      return <>{money(customer.turnover_ytd, cur)}</>
    case 'turnoverPrior':
      return <>{money(customer.turnover_prior_year, cur)}</>
    case 'firstInvoice':
      return <span>{dateText(customer.first_invoice_date)}</span>
    case 'lastInvoice':
      return <span>{dateText(customer.last_invoice_date)}</span>
    case 'lastPayment':
      return <span>{dateText(customer.last_payment_date)}</span>
    case 'opened':
      return <span>{dateText(customer.opened_on)}</span>
    case 'pricing':
      return <TextCell value={customer.pricing_ref} />
    case 'crm':
      return customer.crm_customer ? (
        <Link
          to={crmCustomerPath(customer.crm_customer.id)}
          state={{ linkedName: customer.crm_customer.name }}
          className={LINK}
          title={`Open ${customer.crm_customer.name || 'the CRM customer'}`}
        >
          {customer.crm_customer.name || customer.crm_customer.email || 'CRM customer'}
        </Link>
      ) : (
        DASH
      )
    default:
      return null
  }
}

/** The Action column's View button: opens the customer's own page. */
function ViewButton({ customer }: { customer: SageCustomer }) {
  return (
    <Link
      to={customerPath(customer.account_ref)}
      state={{ linkedName: customer.name || customer.account_ref }}
      aria-label={`View customer ${customer.account_ref}`}
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
 * **Action** (View); the customer's name and account reference open the customer's page, and the CRM
 * column links to the matching CRM customer. The headings of the columns the API can sort by are sort
 * buttons. Handles the loading skeleton, the error and the empty states itself.
 */
export function SageCustomersList({
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
}: SageCustomersListProps) {
  const isTable = useMediaQuery('(min-width: 1024px)')

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load customers</p>
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
          <p className="text-text font-semibold">No customers found</p>
          <p>
            {hasFilters
              ? 'Nothing matches the current search and filters.'
              : 'There are no customers to show yet.'}
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
            Loading customers…
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
          : items.map((customer) => (
              <li
                key={customer.account_ref}
                className="border-border bg-bg flex min-w-0 flex-col gap-1.5 rounded-xl border p-3"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.88rem] font-semibold">
                    <NameLink customer={customer} />
                  </span>
                  <span
                    className={`text-[0.88rem] font-semibold ${
                      customer.over_credit_limit ? 'text-danger' : ''
                    }`}
                  >
                    {money(customer.balance, customer.currency)}
                  </span>
                </span>
                <span className="text-text-muted truncate text-[0.78rem]">
                  {[customer.account_ref, customer.town, customer.email]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge customer={customer} />
                  <span className="text-text-muted text-[0.78rem]">
                    Limit {money(customer.credit_limit, customer.currency)}
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
        style={{ minWidth: `${sageCustomerTableMinWidthRem(columns)}rem` }}
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
                      onClick={() => onSort(column.sort as SageCustomerSort)}
                    />
                  ) : (
                    column.label
                  )}
                </th>
              )
            })}
            <th
              className={TH_ALIGN.center}
              style={{ width: `${SAGE_CUSTOMER_ACTION_COLUMN_REM}rem` }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {isPending && (
            <tr className="sr-only">
              <td role="status">Loading customers…</td>
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
            : items.map((customer) => (
                <tr
                  key={customer.account_ref}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`${TD} whitespace-nowrap ${TD_ALIGN[column.align]}`}
                    >
                      <ColumnCell column={column} customer={customer} />
                    </td>
                  ))}
                  <td className={`${TD} text-center`}>
                    <ViewButton customer={customer} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
