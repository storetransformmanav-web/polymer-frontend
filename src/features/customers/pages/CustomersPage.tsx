import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { ColumnsIcon } from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { PopoverButton } from '../../../components/ui/PopoverButton.tsx'
import {
  CustomerDeleteDialog,
  type CustomerToDelete,
} from '../components/CustomerDeleteDialog.tsx'
import { CustomerDetailsView } from '../components/CustomerDetailsView.tsx'
import { CustomersExport } from '../components/CustomersExport.tsx'
import { CustomersList } from '../components/CustomersList.tsx'
import { CustomersToolbar } from '../components/CustomersToolbar.tsx'
import { useCustomers } from '../hooks/useCustomers.ts'
import { OPTIONAL_COLUMNS, type OptionalColumn } from '../utils/columns.ts'
import { customerName } from '../utils/format.ts'

const LIST_PATH = '/customers'
const detailsPath = (id: string) => `${LIST_PATH}/${encodeURIComponent(id)}`

/**
 * Customers: the list at `/customers`, and one customer's details at
 * `/customers/:id` — both rendered here, in the same page. The list stays
 * mounted (just hidden) while a customer is open, so coming back keeps your
 * scroll, filters and page.
 *
 * Data comes from the Redux cache (see customersSlice.ts), which is what
 * makes moving between pages, filters and customers feel instant.
 */
export function CustomersPage() {
  const customers = useCustomers()
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const { filters, data } = customers

  // `/customers/<id>[/…]` → the customer id; `/customers` → null (the list).
  const activeId = splat ? splat.split('/')[0] || null : null

  // The customer a trash button asked to delete (the dialog confirms), and what to say after.
  const [deleting, setDeleting] = useState<CustomerToDelete | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const closeDelete = useCallback(() => setDeleting(null), [])

  // The extra columns switched on in the Columns menu. The default columns are always there.
  const [columns, setColumns] = useState<ReadonlySet<OptionalColumn>>(() => new Set())

  function toggleColumn(id: OptionalColumn) {
    setColumns((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function handleDeleted(customer: CustomerToDelete, message: string) {
    setDeleting(null)
    setNotice(
      `Deleted “${customer.name}”. ${message || 'It is also deleted in Shopify.'}`,
    )
    // Deleted from its own page: there is nothing left to show, so go back to the list.
    if (activeId === customer.id) navigate(LIST_PATH)
  }

  return (
    <div className="flex flex-col gap-4">
      {activeId && (
        <CustomerDetailsView
          key={activeId}
          id={activeId}
          onBack={() => navigate(LIST_PATH)}
          onDelete={(customer) => {
            setNotice(null)
            setDeleting({ id: activeId, ...customer })
          }}
        />
      )}

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      {/* Kept mounted but hidden while a customer is open (display: none also
          removes it from tab order and screen readers). */}
      <div className={activeId ? 'hidden' : 'flex flex-col gap-4'}>
        <CustomersToolbar
          filters={filters}
          facets={customers.facets}
          total={data?.total ?? null}
          hasFilters={customers.hasFilters}
          onChange={customers.setFilters}
          onReset={customers.resetFilters}
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          <CustomersExport
            items={customers.items}
            page={data?.page ?? filters.page}
            filters={filters}
            total={data?.total ?? 0}
            facets={customers.facets}
          />
          <PopoverButton label="Columns" icon={ColumnsIcon} align="right">
            {() => (
              <div className="flex flex-col">
                <p className="text-text-muted px-2.5 pt-1.5 pb-1 text-[0.72rem] font-bold tracking-wide uppercase">
                  Show more columns
                </p>
                {OPTIONAL_COLUMNS.map((column) => (
                  <label
                    key={column.id}
                    className="hover:bg-accent-tint/60 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem]"
                  >
                    <input
                      type="checkbox"
                      checked={columns.has(column.id)}
                      onChange={() => toggleColumn(column.id)}
                      className="accent-accent h-4 w-4 cursor-pointer"
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
          </PopoverButton>
        </div>

        <section
          aria-label="Customers"
          className="border-border bg-bg relative overflow-hidden rounded-2xl border"
        >
          {/* Thin activity bar: results stay on screen while a refresh runs. */}
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
              customers.isFetching && !customers.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <CustomersList
            items={customers.items}
            isPending={customers.isPending}
            error={customers.error}
            hasFilters={customers.hasFilters}
            isStale={customers.isShowingPrevious}
            columns={columns}
            onOpen={(customer) => navigate(detailsPath(customer.id))}
            onPrefetch={customers.prefetchDetails}
            onDelete={(customer) => {
              setNotice(null)
              setDeleting({
                id: customer.id,
                name: customerName(customer),
                shop: customer.shop?.key ?? null,
                ordersCount: customer.orders_count,
              })
            }}
            onRetry={customers.retry}
            onClearFilters={customers.resetFilters}
          />

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
        </section>
      </div>

      {deleting && (
        <CustomerDeleteDialog
          key={`delete-${deleting.id}`}
          customer={deleting}
          onClose={closeDelete}
          onDone={(message) => handleDeleted(deleting, message)}
        />
      )}
    </div>
  )
}
