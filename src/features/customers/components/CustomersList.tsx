import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
  AlertTriangleIcon,
  EyeIcon,
  SearchIcon,
  TrashIcon,
} from '../../../components/ui/icons.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { CustomerListItem } from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice, initials } from '../../../lib/format.ts'
import {
  capitalize,
  customerLocation,
  customerName,
  roleTone,
  stateTone,
} from '../utils/format.ts'

const TH_BASE =
  'text-text-muted border-border bg-accent-tint/60 sticky top-0 z-[1] border-b px-3 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'overflow-hidden px-3 py-3 text-left align-middle whitespace-nowrap'
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
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-accent-tint text-accent inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold"
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

function Marketing({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined)
    return <span className="text-text-muted">—</span>
  return value ? (
    <Badge tone="success" className={PILL}>
      Subscribed
    </Badge>
  ) : (
    <Badge tone="neutral" className={PILL}>
      Not subscribed
    </Badge>
  )
}

const money = (customer: CustomerListItem) =>
  formatPrice(customer.total_spent ?? '0', customer.currency)
const dateOrDash = (value: string | null | undefined) => (value ? formatDate(value) : '—')

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
}: CustomersListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  // name, subscription, orders, spent, role, joined, last login, actions.
  const columnCount = 8

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
                        {name}
                      </span>
                      <span className="text-text-muted truncate text-[0.78rem]">
                        {customer.email ?? '—'}
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
      className="max-h-[min(68svh,760px)] overflow-auto"
    >
      <table
        className={`w-full min-w-[960px] table-fixed border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={TH}>Customer name</th>
            <th className={`${TH_CENTER} w-44`}>Email subscription</th>
            <th className={`${TH_RIGHT} w-24`}>Orders</th>
            <th className={`${TH_RIGHT} w-36 pr-8`}>Amount spent</th>
            <th className={`${TH_CENTER} w-36`}>Role</th>
            <th className={`${TH_CENTER} w-32`}>Joined</th>
            <th className={`${TH_CENTER} w-32`}>Last login</th>
            <th className={`${TH_CENTER} w-24`}>Actions</th>
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
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold" title={name}>
                            {name}
                          </span>
                          <span
                            className="text-text-muted truncate text-[0.78rem]"
                            title={customer.email ?? ''}
                          >
                            {customer.email ?? '—'}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={`${TD} text-center`}>
                      <Marketing value={customer.accepts_marketing} />
                    </td>
                    <td className={`${TD} text-right`}>
                      {customer.orders_count.toLocaleString('en-GB')}
                    </td>
                    <td className={`${TD} pr-8 text-right font-semibold`}>
                      {money(customer)}
                    </td>
                    <td className={`${TD} text-center`}>
                      <Badge tone={roleTone(customer.role)} className={PILL}>
                        {capitalize(customer.role)}
                      </Badge>
                    </td>
                    <td className={`${TD} text-center`}>
                      {dateOrDash(customer.shopify_created_at)}
                    </td>
                    <td className={`${TD} text-center`}>
                      {dateOrDash(customer.last_login_at)}
                    </td>
                    <td className={`${TD} text-center`}>
                      <span className="inline-flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          aria-label={`View ${name}`}
                          onClick={() => onOpen(customer)}
                          onPointerEnter={() => onPrefetch(customer.id)}
                          onFocus={() => onPrefetch(customer.id)}
                          className="text-text-muted hover:text-accent inline-flex cursor-pointer items-center justify-center border-none bg-none p-1 transition-colors"
                        >
                          <EyeIcon />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${name}`}
                          title="Delete"
                          onClick={() => onDelete(customer)}
                          className="text-text-muted hover:text-danger inline-flex cursor-pointer items-center justify-center border-none bg-none p-1 transition-colors"
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
