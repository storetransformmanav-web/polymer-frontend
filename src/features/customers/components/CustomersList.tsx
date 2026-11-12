import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
  AlertTriangleIcon,
  EyeIcon,
  SearchIcon,
  TrashIcon,
} from '../../../components/ui/icons.tsx'
import { ROW_ACTION, ROW_ACTION_DANGER } from '../../../components/ui/rowActions.ts'
import { ariaSort, SortButton } from '../../../components/ui/SortButton.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { CustomerListItem, CustomerSort } from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice, initials } from '../../../lib/format.ts'
import {
  ACTIONS_COLUMN_REM,
  tableMinWidthRem,
  type CustomerColumnDef,
} from '../utils/columns.ts'
import {
  asFlag,
  asText,
  capitalize,
  customerLocation,
  customerName,
  humanize,
  roleTone,
  stateTone,
} from '../utils/format.ts'

const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
// No alignment here: each cell says its own (a `text-left` here would beat `text-center`).
const TD = 'overflow-hidden px-3 py-3 align-middle whitespace-nowrap'
// The pills (subscription, role): one width, centred in their column, so they line up.
const PILL = 'w-28 justify-center'
const SKELETON_ROWS = 8

interface CustomersListProps {
  items: CustomerListItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  /** Opens a customer's details page (View button / card). */
  onOpen: (customer: CustomerListItem) => void
  /** Hover/focus: start loading details so opening is instant. */
  onPrefetch: (id: string) => void
  /** The trash button of a row: ask to delete this customer. */
  onDelete: (customer: CustomerListItem) => void
  onRetry: () => void
  onClearFilters: () => void
  /** The column the list is sorted by, and its direction (the header's sort buttons). */
  sort: CustomerSort
  order: 'asc' | 'desc'
  /** A header's sort button was clicked. */
  onSort: (sort: CustomerSort) => void
  /** The columns to draw between Customer name and Actions, in order (the Columns menu's choice). */
  columns: CustomerColumnDef[]
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-accent-tint text-accent inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold"
    >
      {initials(name) || '?'}
    </span>
  )
}

function StateBadge({ customer }: { customer: CustomerListItem }) {
  return customer.shopify_state ? (
    <Badge tone={stateTone(customer.shopify_state)}>
      {capitalize(customer.shopify_state)}
    </Badge>
  ) : (
    // No Shopify account state: the customer was created in the CRM.
    <Badge tone="neutral">CRM</Badge>
  )
}

/**
 * The email column. Shopify's own "verified email" flag wins when the answer has it; the list
 * usually carries the CRM's address check instead (`email_check_status`: pending, valid,
 * invalid…), which is shown in words.
 */
function EmailVerified({ customer }: { customer: CustomerListItem }) {
  const { verified_email: verified, email_check_status: check } = customer
  if (verified === true) {
    return (
      <Badge tone="success" className={PILL}>
        Verified
      </Badge>
    )
  }
  if (check) {
    const key = check.toLowerCase()
    const tone =
      key === 'valid' || key === 'verified'
        ? 'success'
        : key === 'pending'
          ? 'warning'
          : key === 'invalid' || key === 'undeliverable' || key === 'bounced'
            ? 'danger'
            : 'neutral'
    return (
      <Badge tone={tone} className={PILL}>
        {key === 'valid' ? 'Verified' : humanize(check)}
      </Badge>
    )
  }
  if (verified === false) {
    return (
      <Badge tone="neutral" className={PILL}>
        Not verified
      </Badge>
    )
  }
  return <span className="text-text-muted">—</span>
}

const money = (customer: CustomerListItem) =>
  formatPrice(customer.total_spent ?? '0', customer.currency)
const dateOrDash = (value: string | null | undefined) => (value ? formatDate(value) : '—')

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

function FlagCell({ value }: { value: unknown }) {
  const flag = asFlag(value)
  return flag === null ? DASH : <span>{flag ? 'Yes' : 'No'}</span>
}

/** A marketing state ("SUBSCRIBED", "NOT_SUBSCRIBED"…) as a pill. */
function MarketingCell({ value }: { value: unknown }) {
  const state = asText(value)
  if (!state) return DASH
  return (
    <Badge
      tone={state.toUpperCase() === 'SUBSCRIBED' ? 'success' : 'neutral'}
      className={PILL}
    >
      {humanize(state)}
    </Badge>
  )
}

/** What one chosen column shows for one customer. */
function ColumnCell({
  column,
  customer,
  name,
}: {
  column: CustomerColumnDef
  customer: CustomerListItem
  name: string
}) {
  switch (column.id) {
    case 'note':
      return <TextCell value={customer.note?.trim() ?? ''} />
    case 'email_subscription':
      return customer.accepts_marketing == null ? (
        DASH
      ) : (
        <Badge tone={customer.accepts_marketing ? 'success' : 'neutral'} className={PILL}>
          {customer.accepts_marketing ? 'Subscribed' : 'Not subscribed'}
        </Badge>
      )
    case 'location':
      return <TextCell value={customerLocation(customer)} />
    case 'orders':
      return <>{customer.orders_count.toLocaleString('en-GB')}</>
    case 'amount_spent':
      return <span className="font-semibold">{money(customer)}</span>
    case 'email':
      return customer.email ? (
        // The address, with a copy button always visible beside it — the same button and box as
        // the product name's on the Products page.
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate" title={customer.email}>
            <Highlight text={customer.email} />
          </span>
          <span className="flex h-5 shrink-0 items-center">
            <CopyButton value={customer.email} label={`Copy email of ${name}`} />
          </span>
        </span>
      ) : (
        DASH
      )
    case 'phone':
      return <TextCell value={customer.phone?.trim() ?? ''} highlight />
    case 'first_name':
      return <TextCell value={customer.first_name?.trim() ?? ''} />
    case 'last_name':
      return <TextCell value={customer.last_name?.trim() ?? ''} />
    case 'postal_code':
      return <TextCell value={asText(customer.zip)} />
    case 'language':
      return <TextCell value={asText(customer.locale)} />
    case 'id': {
      const id = String(customer.shopify_id ?? customer.id)
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate" title={id}>
            {id}
          </span>
          <span className="flex h-5 shrink-0 items-center">
            <CopyButton value={id} label={`Copy id of ${name}`} />
          </span>
        </span>
      )
    }
    case 'added':
      return <>{dateOrDash(customer.shopify_created_at)}</>
    case 'updated':
      return <>{dateOrDash(asText(customer.updated_at))}</>
    case 'sms_subscription':
      return <MarketingCell value={customer.sms_marketing_state} />
    case 'whatsapp_subscription':
      return <MarketingCell value={customer.whatsapp_marketing_state} />
    case 'tax_exempt':
      return <FlagCell value={customer.tax_exempt} />
    case 'deletable':
      return <FlagCell value={customer.can_delete} />
    case 'mergeable':
      return <FlagCell value={customer.mergeable} />
    case 'email_verified':
      return <EmailVerified customer={customer} />
    case 'role':
      return (
        <Badge tone={roleTone(customer.role)} className={PILL}>
          {capitalize(customer.role)}
        </Badge>
      )
    case 'shopify_state':
      return customer.shopify_state ? (
        <Badge tone={stateTone(customer.shopify_state)} className={PILL}>
          {capitalize(customer.shopify_state)}
        </Badge>
      ) : (
        DASH
      )
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
 * The results area: a sticky-header table from `md` up, stacked cards
 * below it. Handles the loading skeleton, error and empty states itself so
 * the page only passes data in.
 */
export function CustomersList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  onOpen,
  onPrefetch,
  onDelete,
  onRetry,
  onClearFilters,
  sort,
  order,
  onSort,
  columns,
}: CustomersListProps) {
  const sortHeader = (label: string, column: CustomerSort) => (
    <SortButton
      label={label}
      active={sort === column}
      order={order}
      onClick={() => onSort(column)}
    />
  )
  const isDesktop = useMediaQuery('(min-width: 768px)')
  // Customer name, the chosen columns and Actions.
  const columnCount = columns.length + 2

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

  if (!isDesktop) {
    return (
      <ul
        aria-busy={isPending || isStale}
        className={`flex flex-col gap-2.5 p-3 transition-opacity duration-150 ${dim}`}
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
                className="border-border bg-surface h-24 animate-pulse rounded-xl border"
              />
            ))
          : items.map((customer) => {
              const name = customerName(customer)
              const location = customerLocation(customer)
              return (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(customer)}
                    onPointerEnter={() => onPrefetch(customer.id)}
                    onFocus={() => onPrefetch(customer.id)}
                    aria-label={`View ${name}`}
                    className="border-border bg-bg hover:border-accent flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors"
                  >
                    <Avatar name={name} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[0.88rem] font-semibold">
                        <Highlight text={name} />
                      </span>
                      <span className="text-text-muted truncate text-[0.78rem]">
                        <Highlight text={customer.email ?? '—'} />
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.82rem]">
                        <Badge tone={roleTone(customer.role)}>
                          {capitalize(customer.role)}
                        </Badge>
                        <StateBadge customer={customer} />
                        <span>
                          {customer.orders_count.toLocaleString('en-GB')}{' '}
                          {customer.orders_count === 1 ? 'order' : 'orders'}
                        </span>
                        <span className="font-semibold">{money(customer)}</span>
                      </span>
                      {(customer.shop?.name || location) && (
                        <span className="text-text-muted truncate text-[0.78rem]">
                          {[customer.shop?.name, location].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
      </ul>
    )
  }

  return (
    <div
      aria-busy={isPending || isStale}
      className="max-h-[min(68svh,760px)] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <table
        style={{ minWidth: `${tableMinWidthRem(columns)}rem` }}
        className={`w-full table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={TH} aria-sort={ariaSort(sort === 'name', order)}>
              {sortHeader('Customer name', 'name')}
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
                aria-sort={
                  column.sort ? ariaSort(sort === column.sort, order) : undefined
                }
              >
                {column.sort ? sortHeader(column.label, column.sort) : column.label}
              </th>
            ))}
            <th className={TH_CENTER} style={{ width: `${ACTIONS_COLUMN_REM}rem` }}>
              Actions
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
                  {Array.from({ length: columnCount }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((customer) => {
                const name = customerName(customer)
                return (
                  <tr
                    key={customer.id}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                  >
                    <td className={TD}>
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={name} />
                        <span className="truncate font-semibold" title={name}>
                          <Highlight text={name} />
                        </span>
                      </span>
                    </td>
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={`${TD} ${
                          column.align === 'right'
                            ? 'text-right'
                            : column.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                        }`}
                      >
                        <ColumnCell column={column} customer={customer} name={name} />
                      </td>
                    ))}
                    <td className={`${TD} text-center`}>
                      <span className="inline-flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          aria-label={`View ${name}`}
                          onClick={() => onOpen(customer)}
                          onPointerEnter={() => onPrefetch(customer.id)}
                          onFocus={() => onPrefetch(customer.id)}
                          className={ROW_ACTION}
                        >
                          <EyeIcon />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${name}`}
                          title="Delete"
                          onClick={() => onDelete(customer)}
                          className={ROW_ACTION_DANGER}
                        >
                          <TrashIcon />
                        </button>
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
