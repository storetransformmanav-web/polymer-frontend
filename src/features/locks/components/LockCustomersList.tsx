import type { ReactNode } from 'react'
import { DetailSection } from '../../../components/ui/DetailSection.tsx'
import {
  AlertTriangleIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ROW_ACTION, ROW_ACTION_DANGER } from '../../../components/ui/rowActions.ts'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { initials } from '../../../lib/format.ts'
import type {
  AccessLock,
  LockCustomer,
  LockCustomerSort,
} from '../../../lib/api/endpoints.ts'
import type { LockCustomersState } from '../hooks/useLockCustomers.ts'
import { canEditCustomer, customerName } from '../utils/format.ts'

const TH =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3.5 py-3 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'
const TD = 'border-border border-b px-3.5 py-2.5 align-middle text-[0.85rem]'
const SKELETON_ROWS = 6

const SORT_OPTIONS: SelectOption[] = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'newest', label: 'Newest' },
]

const BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors'

/** The customer's initials in a round tile, as the Customers list draws them. */
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

/**
 * Who can see the lock's product (`GET /access/locks/{product}/customers`), as a card under Check
 * access: Name, Email, Phone, Company, the lock tags each customer holds (hover: how many locked
 * products share the tag) and the row actions — Edit (a pencil, only when the lock has another key
 * to give) and Remove access (a bin). A search box, a Tag filter (the lock's own tags), a Sort by
 * and the paging footer narrow it, all by the API. **The customers just checked are highlighted** (a
 * tinted row with a "Checked" pill). A login-only lock (no keys) lists every customer with an
 * account and has no row actions. The data and the writes are held by the parent.
 */
export function LockCustomersList({
  lock,
  customers,
  highlight,
  notice,
  onEdit,
  onRemove,
}: {
  lock: AccessLock
  customers: LockCustomersState
  /** The emails (and ids) of the customers that were checked, to highlight. */
  highlight: readonly string[]
  /** The backend's message about the last change. */
  notice?: ReactNode
  onEdit: (customer: LockCustomer) => void
  onRemove: (customer: LockCustomer) => void
}) {
  const { filters, data } = customers
  const loginOnly = lock.tags.length === 0
  const tagOptions: SelectOption[] = [
    { value: '', label: 'All tags' },
    ...lock.tags.map((tag) => ({ value: tag, label: tag })),
  ]
  const marked = new Set(
    highlight.map((ref) => ref.trim().toLowerCase()).filter((ref) => ref !== ''),
  )
  const isChecked = (customer: LockCustomer) =>
    marked.has((customer.email ?? '').toLowerCase()) ||
    marked.has(customer.id.toLowerCase())

  return (
    <DetailSection title="Customers" icon={UsersIcon} count={data?.total} flush>
      <div className="flex flex-col">
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          {notice}
          {loginOnly && (
            <p className="text-text-muted text-[0.82rem]">
              This lock has no keys, so every customer with an account can see the
              product. Add a key on the Overview tab to choose who can.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            {!loginOnly && (
              <div className="w-44 max-w-full">
                <SelectField
                  compact
                  id="lock-customers-tag"
                  label="Tag"
                  value={filters.tag}
                  options={tagOptions}
                  onChange={(tag) => customers.setFilters({ tag })}
                />
              </div>
            )}
            <div className="w-36 max-w-full">
              <SelectField
                compact
                id="lock-customers-sort"
                label="Sort by"
                value={filters.sort}
                options={SORT_OPTIONS}
                onChange={(sort) =>
                  customers.setFilters({ sort: sort as LockCustomerSort })
                }
              />
            </div>
            {customers.hasFilters && (
              <button
                type="button"
                onClick={customers.resetFilters}
                className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
              >
                <XIcon width={14} height={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="border-border overflow-hidden rounded-lg border">
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
                className="max-h-[min(60svh,640px)] overflow-auto lg:max-h-[max(15rem,calc(100svh-43rem))]"
              >
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>Name</th>
                      <th className={TH}>Email</th>
                      <th className={TH}>Phone</th>
                      <th className={TH}>Company</th>
                      <th className={TH}>Tags</th>
                      {!loginOnly && <th className={`${TH} text-center`}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.isPending
                      ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                          <tr key={row} aria-hidden="true">
                            {Array.from({ length: loginOnly ? 5 : 6 }, (_, cell) => (
                              <td key={cell} className={TD}>
                                <span className="bg-surface block h-4 animate-pulse rounded" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : customers.customers.map((customer) => {
                          const checked = isChecked(customer)
                          return (
                            <tr
                              key={customer.id}
                              aria-current={checked ? 'true' : undefined}
                              className={`transition-colors ${
                                checked
                                  ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]'
                                  : 'hover:bg-accent-tint/40'
                              }`}
                            >
                              <td className={`${TD} font-medium`}>
                                <span className="flex flex-wrap items-center gap-3">
                                  <Avatar name={customer.name ?? customer.email ?? ''} />
                                  {customer.name ?? '—'}
                                  {checked && (
                                    <span className="bg-accent text-accent-contrast rounded-full px-2 py-0.5 text-[0.65rem] font-bold">
                                      Checked
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className={TD}>{customer.email ?? '—'}</td>
                              <td className={`${TD} whitespace-nowrap`}>
                                {customer.phone ?? '—'}
                              </td>
                              <td className={TD}>{customer.company ?? '—'}</td>
                              <td className={TD}>
                                {customer.tags.length === 0 ? (
                                  <span className="text-text-muted">—</span>
                                ) : (
                                  <span className="flex flex-wrap gap-1">
                                    {customer.tags.map((tag) => {
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
                                  <span className="inline-flex items-center gap-1.5">
                                    {canEditCustomer(lock, customer) && (
                                      <button
                                        type="button"
                                        aria-label={`Edit access of ${customerName(customer)}`}
                                        title="Edit access"
                                        onClick={() => onEdit(customer)}
                                        className={ROW_ACTION}
                                      >
                                        <PencilIcon />
                                      </button>
                                    )}
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
    </DetailSection>
  )
}
