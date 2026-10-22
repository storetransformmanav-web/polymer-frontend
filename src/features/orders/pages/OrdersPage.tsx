import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { StatCard, type StatCardProps } from '../../../components/ui/StatCard.tsx'
import {
  CheckCircleIcon,
  DollarSignIcon,
  OrdersIcon,
  RefreshIcon,
} from '../../../components/ui/icons.tsx'
import type { OrderListResponse } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import { OrdersList } from '../components/OrdersList.tsx'
import { OrdersToolbar } from '../components/OrdersToolbar.tsx'
import { useOrders } from '../hooks/useOrders.ts'

/**
 * The sums over every order that matches the filters (from the API's `totals`, not just
 * this page). The API gives no currency for them, so the first order's is used.
 */
function summaryCards(data: OrderListResponse | null): StatCardProps[] {
  const totals = data?.totals
  const currency = data?.items[0]?.currency
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : formatPrice(value, currency)
  return [
    {
      icon: OrdersIcon,
      label: 'Orders',
      value: (totals?.orders ?? data?.total)?.toLocaleString('en-GB') ?? '—',
      meta: 'Matching filters',
    },
    {
      icon: DollarSignIcon,
      label: 'Total sales',
      value: money(totals?.total_price),
      meta: 'Order totals',
    },
    {
      icon: RefreshIcon,
      label: 'Refunded',
      value: money(totals?.total_refunded),
      meta: 'Returned to customers',
      tone: 'warning',
    },
    {
      icon: CheckCircleIcon,
      label: 'Net payment',
      value: money(totals?.net_payment),
      meta: 'Paid, after refunds',
    },
  ]
}

/**
 * Orders: the list at `/orders`, read from the API with the same caching as products
 * and customers (see ordersSlice.ts) — cached pages show at once, the previous results
 * stay on screen while a new query loads, and the next page is already in the cache.
 */
export function OrdersPage() {
  const orders = useOrders()
  const { filters, data } = orders

  return (
    <div className="flex flex-col gap-4">
      <OrdersToolbar
        filters={filters}
        facets={orders.facets}
        total={data?.total ?? null}
        hasFilters={orders.hasFilters}
        onChange={orders.setFilters}
        onReset={orders.resetFilters}
      />

      <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4">
        {summaryCards(data).map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <section
        aria-label="Orders"
        className="border-border bg-bg relative overflow-hidden rounded-2xl border"
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
