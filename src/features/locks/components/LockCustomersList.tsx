import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangleIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ROW_ACTION, ROW_ACTION_DANGER } from '../../../components/ui/rowActions.ts'
import { useLinkedState } from '../../../hooks/useLinkedState.ts'
import { initials } from '../../../lib/format.ts'
import type { AccessLock, LockCustomer } from '../../../lib/api/endpoints.ts'
import type { LockCustomersState } from '../hooks/useLockCustomers.ts'
import { canEditCustomer, customerName, linkedCustomerPath } from '../utils/format.ts'

const TH =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3 py-2.5 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'
const TD = 'border-border border-b px-3 py-1.5 align-middle'
const SKELETON_ROWS = 6

const BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors'

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
 * to give) and Remove access (a bin). A search box, a Tag filter (the lock's own tags), a Sort by
 * and the paging footer narrow it, all by the API. A login-only lock (no keys) lists every customer with an
 * account and has no row actions. The data and the writes are held by the parent.
 */
export function LockCustomersList({
  lock,
  customers,
  notice,
  onEdit,
  onRemove,
}: {
  lock: AccessLock
  customers: LockCustomersState
  /** The backend's message about the last change. */
  notice?: ReactNode
  onEdit: (customer: LockCustomer) => void
  onRemove: (customer: LockCustomer) => void
}) {
  const linkedState = useLinkedState()
  const { filters, data } = customers
  const loginOnly = lock.tags.length === 0

  return (
    <section
      aria-label="Customers with access"
      className="border-border-strong flex min-h-[22rem] flex-col border-t lg:min-h-[16rem] lg:flex-1"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <h3 className="m-0 flex items-center gap-2.5 text-[0.95rem] font-semibold">
            <UsersIcon width={18} height={18} className="text-accent shrink-0" />
            Customers
            <span className="bg-surface text-text-muted border-border rounded-full border px-2 py-0.5 text-[0.68rem] font-bold">
              {data?.total ?? '—'}
            </span>
          </h3>
          {notice}
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
                <table className="w-full min-w-[960px] table-fixed border-collapse text-[0.85rem]">
                  <thead>
                    <tr>
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
                            {Array.from({ length: loginOnly ? 5 : 6 }, (_, cell) => (
                              <td key={cell} className={TD}>
                                <span className="bg-surface block h-4 animate-pulse rounded" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : customers.customers.map((customer) => {
                          return (
                            <tr
                              key={customer.id}
                              className="even:bg-surface hover:bg-accent-tint/60 transition-colors"
                            >
                              <td className={`${TD} font-medium`}>
                                <span className="flex flex-wrap items-center gap-3">
                                  <Avatar name={customer.name ?? customer.email ?? ''} />
                                  <Link
                                    to={linkedCustomerPath(customer.id)}
                                    state={linkedState(customer.name ?? customer.email)}
                                    title="Open the customer's details"
                                    className="text-text hover:text-accent no-underline hover:underline"
                                  >
                                    {customer.name ?? customer.email ?? '—'}
                                  </Link>
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
                                  <span className="inline-flex items-center gap-1">
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
    </section>
  )
}
