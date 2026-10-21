import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, EyeIcon, SearchIcon } from '../../../components/ui/icons.tsx'
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
  'text-text-muted border-border bg-accent-tint/60 sticky top-0 z-[1] border-b px-3.5 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
const TD = 'px-3.5 py-2.5 text-left whitespace-nowrap'
// Wider-screen-only columns, so the table never needs sideways scrolling on laptops.
const FROM_XL = 'hidden xl:table-cell'
const FROM_2XL = 'hidden 2xl:table-cell'
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
    <Badge tone="success">Subscribed</Badge>
  ) : (
    <span className="text-text-muted">No</span>
  )
}

const money = (customer: CustomerListItem) =>
  formatPrice(customer.total_spent ?? '0', customer.currency)
const dateOrDash = (value: string | null | undefined) => (value ? formatDate(value) : '—')

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-text-muted">—</span>
  return (
    <span className="flex items-center gap-1">
      {tags.slice(0, 2).map((tag) => (
        <span
          key={tag}
          className="bg-surface border-border max-w-24 truncate rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
        >
          {tag}
        </span>
      ))}
      {tags.length > 2 && (
        <span className="text-text-muted text-[0.7rem]" title={tags.slice(2).join(', ')}>
          +{tags.length - 2}
        </span>
      )}
    </span>
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
  onRetry,
  onClearFilters,
}: CustomersListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

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
        className={`w-full min-w-[720px] border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={TH}>Customer</th>
            <th className={`${TH} ${FROM_XL}`}>Store</th>
            <th className={TH}>Role</th>
            <th className={TH}>State</th>
            <th className={TH_RIGHT}>Orders</th>
            <th className={TH_RIGHT}>Total Spent</th>
            <th className={`${TH} ${FROM_XL}`}>Location</th>
            <th className={TH}>Marketing</th>
            <th className={TH}>Joined</th>
            <th className={`${TH} ${FROM_2XL}`}>Tags</th>
            <th className={`${TH} ${FROM_2XL}`}>Last Login</th>
            <th className={TH_CENTER}>View</th>
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
                  {Array.from({ length: 8 }, (_, cell) => (
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
                      <span className="flex items-center gap-3">
                        <Avatar name={name} />
                        <span className="flex min-w-0 flex-col">
                          <span className="max-w-56 truncate font-semibold" title={name}>
                            {name}
                          </span>
                          <span
                            className="text-text-muted max-w-56 truncate text-[0.78rem]"
                            title={customer.email ?? ''}
                          >
                            {customer.email ?? '—'}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={`${TD} ${FROM_XL}`}>
                      <span
                        className="block max-w-40 truncate"
                        title={customer.shop?.name ?? ''}
                      >
                        {customer.shop?.name || '—'}
                      </span>
                    </td>
                    <td className={TD}>
                      <Badge tone={roleTone(customer.role)}>
                        {capitalize(customer.role)}
                      </Badge>
                    </td>
                    <td className={TD}>
                      <StateBadge customer={customer} />
                    </td>
                    <td className={`${TD} text-right`}>
                      {customer.orders_count.toLocaleString('en-GB')}
                    </td>
                    <td className={`${TD} text-right font-semibold`}>
                      {money(customer)}
                    </td>
                    <td className={`${TD} ${FROM_XL}`}>
                      <span
                        className="block max-w-48 truncate"
                        title={customerLocation(customer)}
                      >
                        {customerLocation(customer) || '—'}
                      </span>
                    </td>
                    <td className={TD}>
                      <Marketing value={customer.accepts_marketing} />
                    </td>
                    <td className={TD}>{dateOrDash(customer.shopify_created_at)}</td>
                    <td className={`${TD} ${FROM_2XL}`}>
                      <Tags tags={customer.tags} />
                    </td>
                    <td className={`${TD} ${FROM_2XL}`}>
                      {dateOrDash(customer.last_login_at)}
                    </td>
                    <td className={`${TD} text-center`}>
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
                    </td>
                  </tr>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
