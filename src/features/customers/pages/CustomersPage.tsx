import { useNavigate, useParams } from 'react-router-dom'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { CustomerDetailsView } from '../components/CustomerDetailsView.tsx'
import { CustomersList } from '../components/CustomersList.tsx'
import { CustomersToolbar } from '../components/CustomersToolbar.tsx'
import { useCustomers } from '../hooks/useCustomers.ts'

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

  return (
    <div className="flex flex-col gap-4">
      {activeId && (
        <CustomerDetailsView
          key={activeId}
          id={activeId}
          onBack={() => navigate(LIST_PATH)}
        />
      )}

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
            onOpen={(customer) => navigate(detailsPath(customer.id))}
            onPrefetch={customers.prefetchDetails}
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
    </div>
  )
}
