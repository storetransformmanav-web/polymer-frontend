import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { SageOrderSort } from '../../../lib/api/sageOrders.ts'
import { SageOrdersKpis } from '../components/SageOrdersKpis.tsx'
import { SageOrdersList } from '../components/SageOrdersList.tsx'
import { SageOrdersToolbar } from '../components/SageOrdersToolbar.tsx'
import { useSageOrderColumns } from '../hooks/useSageOrderColumns.ts'
import { useSageOrders } from '../hooks/useSageOrders.ts'
import { SAGE_ORDER_COLUMNS } from '../utils/columns.ts'
import { listCurrency } from '../utils/format.ts'

/**
 * Sage 50 → Orders: the sales orders from `GET /api/sage/orders`, laid out like the Invoices, Sage
 * customers and Orders pages — the figures from the answer's `totals` and `status_counts`, the search
 * row, the Columns menu and the filter grid, then the table in its own scrolling box with the
 * pagination under it. Everything — the status, search, filters, sorting, the page and its size — is
 * asked of the API (TanStack Query, see useSageOrders), so it covers all the orders, not just the
 * ones on screen. A customer's name opens that customer's page and an invoice number the invoice's;
 * the API has no call for one order, so a row has no page of its own. The top bar has the page's Refresh.
 */
export function SageOrdersPage() {
  const orders = useSageOrders()
  const columnChoice = useSageOrderColumns()
  const { filters, data } = orders
  // The API gives no currency for the totals: the first order's is used (pounds otherwise).
  const currency = listCurrency(orders.items)

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh visible refreshing={orders.isFetching} onRefresh={orders.retry} />

      <SageOrdersKpis
        totals={data?.totals ?? null}
        total={data?.total ?? null}
        statusCounts={data?.statusCounts ?? {}}
        currency={currency}
        status={filters.status}
        onStatus={(status) => orders.setFilters({ status })}
      />

      <SageOrdersToolbar
        filters={filters}
        statusCounts={data?.statusCounts ?? {}}
        // Clear All also puts the columns back to the default, so a changed choice counts as
        // something to clear.
        hasFilters={orders.hasFilters || !columnChoice.isDefault}
        onChange={orders.setFilters}
        onReset={() => {
          orders.resetFilters()
          columnChoice.reset()
        }}
        actions={
          // Only the table has columns; the cards of a narrow screen do not.
          <div className="hidden lg:block">
            <ColumnsMenu
              config={columnChoice.config}
              labelOf={(id) => SAGE_ORDER_COLUMNS[id].label}
              onToggle={columnChoice.toggle}
              onMove={columnChoice.move}
              onReset={columnChoice.reset}
            />
          </div>
        }
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

        <HighlightQuery query={filters.search}>
          <SageOrdersList
            items={orders.items}
            columns={columnChoice.columns}
            isPending={orders.isPending}
            error={orders.error}
            hasFilters={orders.hasFilters}
            isStale={orders.isShowingPrevious}
            sort={filters.sort}
            order={filters.order}
            // A new column starts ascending; the same column flips direction.
            onSort={(sort: SageOrderSort) =>
              orders.setFilters(
                sort === filters.sort
                  ? { order: filters.order === 'asc' ? 'desc' : 'asc' }
                  : { sort, order: 'asc' },
              )
            }
            onRetry={orders.retry}
            onClearFilters={orders.resetFilters}
          />
        </HighlightQuery>

        {data && data.total > 0 && (
          <PaginationFooter
            page={data.page}
            pageSize={filters.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={(page) => orders.setFilters({ page })}
            onPageSizeChange={(pageSize) => orders.setFilters({ pageSize })}
          />
        )}
      </section>
    </div>
  )
}
