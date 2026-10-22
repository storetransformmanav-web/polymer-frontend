import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { OrdersKpis } from '../components/OrdersKpis.tsx'
import { OrdersList } from '../components/OrdersList.tsx'
import { OrdersToolbar } from '../components/OrdersToolbar.tsx'
import { useOrders } from '../hooks/useOrders.ts'

/**
 * Orders: the list at `/orders`, read from the API with the same caching as products
 * and customers (see ordersSlice.ts) — cached pages show at once, the previous results
 * stay on screen while a new query loads, and the next page is already in the cache.
 * Laid out like the order-management design: the figures, the tabs, the search row,
 * then the table. From `lg` up it fills the height of the main area (the page itself
 * does not scroll): the table scrolls inside its own box, under a sticky header, with
 * the paging fixed beneath it.
 */
export function OrdersPage() {
  const orders = useOrders()
  const { filters, data } = orders

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <OrdersKpis data={data} />

      <OrdersToolbar
        filters={filters}
        facets={orders.facets}
        total={data?.total ?? null}
        hasFilters={orders.hasFilters}
        onChange={orders.setFilters}
        onReset={orders.resetFilters}
      />

      <section
        aria-label="Orders"
        className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
      >
        {/* Thin activity bar: results stay on screen while a refresh runs. */}
        <div
          aria-hidden="true"
          className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
            orders.isFetching && !orders.isPending
              ? 'animate-pulse opacity-100'
              : 'opacity-0'
          }`}
        />

        <OrdersList
          items={orders.items}
          isPending={orders.isPending}
          error={orders.error}
          hasFilters={orders.hasFilters}
          isStale={orders.isShowingPrevious}
          onRetry={orders.retry}
          onClearFilters={orders.resetFilters}
        />

        {data && data.total > 0 && (
          <PaginationFooter
            page={data.page}
            pageSize={filters.pageSize}
            total={data.total}
            totalPages={data.total_pages}
            onPageChange={(page) => orders.setFilters({ page })}
            onPageSizeChange={(pageSize) => orders.setFilters({ pageSize })}
          />
        )}
      </section>
    </div>
  )
}
