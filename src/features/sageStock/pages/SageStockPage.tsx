import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { SageStockSort } from '../../../lib/api/sageStock.ts'
import { SageStockKpis } from '../components/SageStockKpis.tsx'
import { SageStockList } from '../components/SageStockList.tsx'
import { SageStockToolbar } from '../components/SageStockToolbar.tsx'
import { useSageStock } from '../hooks/useSageStock.ts'
import { useSageStockColumns } from '../hooks/useSageStockColumns.ts'
import { SAGE_STOCK_COLUMNS } from '../utils/columns.ts'

/**
 * Sage 50 → Stock: the stock items from `GET /api/sage/stock`, laid out like the Products, Orders and
 * Sage customers pages — the figures from the answer's `totals` and `tab_counts`, the search row, the
 * Columns menu and the filter grid, then the table in its own scrolling box with the pagination under
 * it. Everything — the stock status, search, filters, sorting, the page and its size — is asked of the
 * API (TanStack Query, see useSageStock), so it covers all the items, not just the ones on screen. The
 * API has no call for one stock item, so a row has no page of its own; the Shopify column links to the
 * CRM product that has the SKU. The top bar has the page's Refresh.
 */
export function SageStockPage() {
  const stock = useSageStock()
  const columnChoice = useSageStockColumns()
  const { filters, data } = stock

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh visible refreshing={stock.isFetching} onRefresh={stock.retry} />

      <SageStockKpis
        total={data?.total ?? null}
        tabCounts={data?.tabCounts ?? {}}
        tab={filters.tab}
        onTab={(tab) => stock.setFilters({ tab })}
      />

      <SageStockToolbar
        filters={filters}
        tabCounts={data?.tabCounts ?? {}}
        // Clear All also puts the columns back to the default, so a changed choice counts as
        // something to clear.
        hasFilters={stock.hasFilters || !columnChoice.isDefault}
        onChange={stock.setFilters}
        onReset={() => {
          stock.resetFilters()
          columnChoice.reset()
        }}
        actions={
          // Only the table has columns; the cards of a narrow screen do not.
          <div className="hidden lg:block">
            <ColumnsMenu
              config={columnChoice.config}
              labelOf={(id) => SAGE_STOCK_COLUMNS[id].label}
              onToggle={columnChoice.toggle}
              onMove={columnChoice.move}
              onReset={columnChoice.reset}
            />
          </div>
        }
      />

      <section
        aria-label="Stock"
        className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
      >
        {/* Thin activity bar: results stay on screen while a refresh runs. */}
        <div
          aria-hidden="true"
          className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
            stock.isFetching && !stock.isPending
              ? 'animate-pulse opacity-100'
              : 'opacity-0'
          }`}
        />

        <HighlightQuery query={filters.search}>
          <SageStockList
            items={stock.items}
            columns={columnChoice.columns}
            isPending={stock.isPending}
            error={stock.error}
            hasFilters={stock.hasFilters}
            isStale={stock.isShowingPrevious}
            sort={filters.sort}
            order={filters.order}
            // A new column starts ascending; the same column flips direction.
            onSort={(sort: SageStockSort) =>
              stock.setFilters(
                sort === filters.sort
                  ? { order: filters.order === 'asc' ? 'desc' : 'asc' }
                  : { sort, order: 'asc' },
              )
            }
            onRetry={stock.retry}
            onClearFilters={stock.resetFilters}
          />
        </HighlightQuery>

        {data && data.total > 0 && (
          <PaginationFooter
            page={data.page}
            pageSize={filters.pageSize}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={(page) => stock.setFilters({ page })}
            onPageSizeChange={(pageSize) => stock.setFilters({ pageSize })}
          />
        )}
      </section>
    </div>
  )
}
