import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangleIcon,
  TrashIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { Highlight, HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ROW_ACTION_DANGER } from '../../../components/ui/rowActions.ts'
import { findOwnTag } from '../utils/lockDraft.ts'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { useLinkedState } from '../../../hooks/useLinkedState.ts'
import { initials } from '../../../lib/format.ts'
import type { AccessLock, LockCustomer } from '../../../lib/api/endpoints.ts'
import type { LockCustomersState } from '../hooks/useLockCustomers.ts'
import { customerName, customerRef, linkedCustomerPath } from '../utils/format.ts'

const TH =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-2.5 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'
// Smaller type than before, and one line per cell: a long name, email or company is cut with "…"
// (see `Cell`) and its full text is the hover text, so every row is the same height.
const TD = 'border-border overflow-hidden border-b px-3 py-1.5 align-middle'
const SKELETON_ROWS = 6

const BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors'

/**
 * One line of text, cut with "…" when the cell is too narrow; hovering shows the full text. What was
 * searched for is still marked in yellow.
 */
function Cell({ text }: { text: string | null | undefined }) {
  if (!text) return <>—</>
  return (
    <span className="block truncate" title={text}>
      <Highlight text={text} />
    </span>
  )
}

/** The customer's initials in a round tile, as the Customers list draws them. */
function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-accent-tint text-accent inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.72rem] font-bold"
    >
      {initials(name) || '?'}
    </span>
  )
}

/**
 * Who can see the lock's product (`GET /access/locks/{product}/customers`), as a card under Check
 * access: Name, Email, Phone, Company, the lock tags each customer holds (hover: how many locked
 * products share the tag) and the row actions — Edit (a pencil, only when the lock has another key
 * to give). A search box, a Tag filter (the lock's own tags), a Sort by
 * and the paging footer narrow it, all by the API. A login-only lock (no keys) lists every customer with an
 * account and has no row actions. The data and the writes are held by the parent.
 */
export function LockCustomersList({
  lock,
  customers,
  notice,
  onRemove,
  selected,
  onSelect,
  onRemoveMany,
}: {
  lock: AccessLock
  customers: LockCustomersState
  /** The backend's message about the last change. */
  notice?: ReactNode
  onRemove: (customer: LockCustomer) => void
  /** The ticked customers, by `customerRef` in lower case (just-added ones come back ticked). */
  selected: ReadonlySet<string>
  onSelect: (next: Set<string>) => void
  /** "Remove access (N)": the ticked customers on this page. */
  onRemoveMany: (customers: LockCustomer[]) => void
}) {
  const linkedState = useLinkedState()
  const { filters, data } = customers
  const loginOnly = lock.tags.length === 0
  const ownTag = findOwnTag(lock.tags, lock.handle)
  const keyOf = (customer: LockCustomer) => customerRef(customer).toLowerCase()
  const rows = customers.customers
  const picked = rows.filter((customer) => selected.has(keyOf(customer)))
  const allPicked = rows.length > 0 && picked.length === rows.length
  function toggleOne(customer: LockCustomer) {
    const next = new Set(selected)
    if (next.has(keyOf(customer))) next.delete(keyOf(customer))
    else next.add(keyOf(customer))
    onSelect(next)
  }
  function toggleAll() {
    const next = new Set(selected)
    for (const customer of rows) {
      if (allPicked) next.delete(keyOf(customer))
      else next.add(keyOf(customer))
    }
    onSelect(next)
  }
  // Typing is instant here and sent to the API once the person pauses; Check also sets this
  // search (to the customer's email), so the box follows it.
  const [search, setSearch] = useDebouncedField(filters.search, (value) =>
    customers.setFilters({ search: value }),
  )

  return (
    <section
      aria-label="Customers with access"
      className="border-border-strong flex min-h-[22rem] flex-col border-t lg:min-h-[16rem] lg:flex-1"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="m-0 flex items-center gap-2.5 text-[0.95rem] font-semibold">
              <UsersIcon width={18} height={18} className="text-accent shrink-0" />
              Customers
              <span className="bg-surface text-text-muted border-border rounded-full border px-2 py-0.5 text-[0.68rem] font-bold">
                {data?.total ?? '—'}
              </span>
            </h3>
            <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-10 w-full min-w-0 items-center gap-2.5 rounded-lg border px-3 transition-colors focus-within:outline-2 sm:w-96">
              <SearchIcon className="text-text-muted shrink-0" />
              <input
                type="search"
                aria-label="Search customers with access"
                placeholder="Search customers by name, email or company…"
                maxLength={200}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.88rem] outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear customer search"
                  onClick={() => setSearch('')}
                  className="text-text-muted hover:text-text cursor-pointer border-none bg-none p-0.5"
                >
                  <XIcon width={16} height={16} />
                </button>
              )}
            </div>
          </div>
          {notice}
          {!loginOnly && picked.length > 0 && (
            <div className="border-border bg-accent-tint/40 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-[0.82rem]">
              <span className="font-semibold">{picked.length} selected</span>
              <button
                type="button"
                onClick={() => onSelect(new Set())}
                className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0 font-semibold underline"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={() => onRemoveMany(picked)}
                className="border-danger text-danger hover:bg-danger-bg ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-transparent px-3 text-[0.8rem] font-semibold transition-colors"
              >
                <TrashIcon width={14} height={14} />
                Remove access ({picked.length})
              </button>
            </div>
          )}
          {loginOnly && (
            <p className="text-text-muted text-[0.82rem]">
              This lock has no keys, so every customer with an account can see the
              product. Add a key on the Overview tab to choose who can.
            </p>
          )}
        </div>

        {/* The table runs the whole width of the card and fills its height, like the Products
            list's: sticky header, rows of the same size, the paging footer fixed under it. */}
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          <div className="border-border bg-bg relative flex min-h-0 flex-1 flex-col overflow-hidden border-t">
            {customers.error ? (
              <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-12 text-center text-[0.9rem]">
                <AlertTriangleIcon width={26} height={26} className="text-danger" />
                <p className="text-text m-0 font-semibold">
                  Couldn&apos;t load the customers
                </p>
                <p className="m-0">{customers.error}</p>
                <button
                  type="button"
                  onClick={customers.retry}
                  className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
                >
                  Try again
                </button>
              </div>
            ) : !customers.isPending && customers.customers.length === 0 ? (
              <div className="text-text-muted flex flex-col items-center gap-2 px-4 py-12 text-center text-[0.9rem]">
                <UsersIcon width={26} height={26} />
                <p className="m-0">
                  {customers.hasFilters
                    ? 'No customer matches these filters.'
                    : 'No customer can see this product yet.'}
                </p>
              </div>
            ) : (
              <div
                aria-busy={customers.isPending || customers.isShowingPrevious}
                className="min-h-0 flex-1 overflow-auto"
              >
                <HighlightQuery query={filters.search}>
                  <table className="w-full min-w-[960px] table-fixed border-collapse text-[0.78rem]">
                    <thead>
                      <tr>
                        {!loginOnly && (
                          <th className={`${TH} w-10`}>
                            <input
                              type="checkbox"
                              aria-label="Select every customer on this page"
                              checked={allPicked}
                              disabled={rows.length === 0}
                              onChange={toggleAll}
                              className="accent-accent h-4 w-4 cursor-pointer"
                            />
                          </th>
                        )}
                        <th className={`${TH} w-[24%]`}>Name</th>
                        <th className={`${TH} w-[27%]`}>Email</th>
                        <th className={`${TH} w-[12%]`}>Phone</th>
                        <th className={`${TH} w-[20%]`}>Company</th>
                        <th className={`${TH} w-[10%]`}>Tags</th>
                        {!loginOnly && (
                          <th className={`${TH} w-24 text-center`}>Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {customers.isPending
                        ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                            <tr key={row} aria-hidden="true">
                              {Array.from({ length: loginOnly ? 5 : 7 }, (_, cell) => (
                                <td key={cell} className={TD}>
                                  <span className="bg-surface block h-4 animate-pulse rounded" />
                                </td>
                              ))}
                            </tr>
                          ))
                        : customers.customers.map((customer) => {
                            // The tags chosen for the lock; its own `lock-…` tag is internal.
                            const shownTags = customer.tags.filter(
                              (tag) => tag.toLowerCase() !== ownTag?.toLowerCase(),
                            )
                            return (
                              <tr
                                key={customer.id}
                                className={`transition-colors ${
                                  selected.has(keyOf(customer))
                                    ? 'bg-accent-tint/50'
                                    : 'even:bg-surface hover:bg-accent-tint/60'
                                }`}
                              >
                                {!loginOnly && (
                                  <td className={TD}>
                                    <input
                                      type="checkbox"
                                      aria-label={`Select ${customerName(customer)}`}
                                      checked={selected.has(keyOf(customer))}
                                      onChange={() => toggleOne(customer)}
                                      className="accent-accent h-4 w-4 cursor-pointer"
                                    />
                                  </td>
                                )}
                                <td className={`${TD} font-medium`}>
                                  <span className="flex min-w-0 items-center gap-2.5">
                                    <Avatar
                                      name={customer.name ?? customer.email ?? ''}
                                    />
                                    <Link
                                      to={linkedCustomerPath(customer.id)}
                                      state={linkedState(customer.name ?? customer.email)}
                                      title={customer.name ?? customer.email ?? undefined}
                                      className="text-text hover:text-accent min-w-0 truncate no-underline hover:underline"
                                    >
                                      <Highlight
                                        text={customer.name ?? customer.email ?? '—'}
                                      />
                                    </Link>
                                  </span>
                                </td>
                                <td className={TD}>
                                  <Cell text={customer.email} />
                                </td>
                                <td className={`${TD} whitespace-nowrap`}>
                                  {customer.phone ?? '—'}
                                </td>
                                <td className={TD}>
                                  <Cell text={customer.company} />
                                </td>
                                <td className={TD}>
                                  {shownTags.length === 0 ? (
                                    <span className="text-text-muted">—</span>
                                  ) : (
                                    <span className="flex flex-wrap gap-1">
                                      {shownTags.map((tag) => {
                                        const shared = customers.tags.find(
                                          (item) =>
                                            item.tag.toLowerCase() === tag.toLowerCase(),
                                        )?.locked_products
                                        return (
                                          <span
                                            key={tag}
                                            title={
                                              shared
                                                ? `Shared by ${shared} locked ${shared === 1 ? 'product' : 'products'}`
                                                : undefined
                                            }
                                            className="bg-surface border-border rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
                                          >
                                            {tag}
                                          </span>
                                        )
                                      })}
                                    </span>
                                  )}
                                </td>
                                {!loginOnly && (
                                  <td className={`${TD} text-center whitespace-nowrap`}>
                                    <span className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        aria-label={`Remove access of ${customerName(customer)}`}
                                        title="Remove access"
                                        onClick={() => onRemove(customer)}
                                        className={ROW_ACTION_DANGER}
                                      >
                                        <TrashIcon />
                                      </button>
                                    </span>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                    </tbody>
                  </table>
                </HighlightQuery>
              </div>
            )}

            {data && data.total > 0 && (
              <PaginationFooter
                page={data.page}
                pageSize={filters.pageSize}
                total={data.total}
                totalPages={data.total_pages}
                onPageChange={(page) => customers.setFilters({ page })}
                onPageSizeChange={(pageSize) => customers.setFilters({ pageSize })}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
