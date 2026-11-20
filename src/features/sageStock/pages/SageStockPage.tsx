import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { BoxesIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { SageStockSort } from '../../../lib/api/sageStock.ts'
import { SageStockDetailsView } from '../components/SageStockDetailsView.tsx'
import { SageStockExport } from '../components/SageStockExport.tsx'
import { SageStockKpis } from '../components/SageStockKpis.tsx'
import { SageStockList } from '../components/SageStockList.tsx'
import { SageStockToolbar } from '../components/SageStockToolbar.tsx'
import { useSageStock } from '../hooks/useSageStock.ts'
import { useSageStockColumns } from '../hooks/useSageStockColumns.ts'
import { SAGE_STOCK_COLUMNS } from '../utils/columns.ts'
import { LIST_PATH, stockPath } from '../utils/paths.ts'

const MAX_TABS = 10

// From `lg` the page fills the window (`fillHeight` in navigation.ts): the table scrolls in its own
// box, and an opened item's page scrolls inside this one.
const SCROLL_VIEW = 'relative flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto'

/** An opened stock item: a tab in the strip above the list. */
interface DetailTab {
  key: string
  label: string
  /** Where its tab leads (pathname, as in the address bar). */
  path: string
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Sage 50 → Stock: the stock items from `GET /api/sage/stock`, laid out like the Products, Orders and
 * Sage customers pages — the figures from the answer's `totals` and `tab_counts`, the search row, the
 * Columns menu and the filter grid, then the table in its own scrolling box with the pagination under
 * it. Everything — the stock status, search, filters, sorting, the page and its size — is asked of the
 * API (TanStack Query, see useSageStock), so it covers all the items, not just the ones on screen. A
 * stock code or the View button opens the item's own page (`/sage/stock/<code>`,
 * `GET /api/sage/stock/{stock_code}`) **in this same page, as a tab of its own**, like a product's page;
 * the list stays mounted behind, so Back finds it as it was. The Shopify column links to the CRM product
 * that has the SKU. The top bar has the page's Refresh and Export (a CSV).
 */
export function SageStockPage() {
  const stock = useSageStock()
  const columnChoice = useSageStockColumns()
  const { filters, data } = stock
  const navigate = useNavigate()
  const { '*': splat } = useParams()

  // `/sage/stock` → the list; `/sage/stock/<code>` → one stock item (the whole rest of the address is
  // the code, which may hold a "/").
  const stockCode = splat ? decode(splat) : null
  const activeKey = stockCode ? `stock:${stockCode}` : null

  const [tabs, setTabs] = useState<DetailTab[]>([])
  // The address that was on screen before this render (null = the list). A tab is opened **when the
  // address arrives at an item**, not whenever its tab is missing: closing a tab removes it a moment
  // before the address leaves it, and that gap must not open it again; going back to the list forgets
  // the address, so a closed item can be opened again. (React's "adjust state while rendering".)
  const [lastKey, setLastKey] = useState<string | null>(null)
  if (activeKey !== lastKey) {
    setLastKey(activeKey)
    if (activeKey && stockCode && !tabs.some((tab) => tab.key === activeKey)) {
      const tab: DetailTab = {
        key: activeKey,
        label: stockCode,
        path: stockPath(stockCode),
      }
      setTabs((current) =>
        current.some((candidate) => candidate.key === activeKey)
          ? current
          : [...current, tab].slice(-MAX_TABS),
      )
    }
  }

  function rename(key: string, label: string) {
    setTabs((current) =>
      current.map((tab) =>
        tab.key === key && tab.label !== label ? { ...tab, label } : tab,
      ),
    )
  }

  function closeTab(key: string) {
    const index = tabs.findIndex((tab) => tab.key === key)
    const neighbour = tabs[index + 1] ?? tabs[index - 1]
    setTabs((current) => current.filter((tab) => tab.key !== key))
    if (key === activeKey) navigate(neighbour?.path ?? LIST_PATH)
  }

  const preview = stockCode
    ? (stock.items.find((item) => item.stock_code === stockCode) ?? null)
    : null

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh
        visible={!activeKey}
        refreshing={stock.isFetching}
        onRefresh={stock.retry}
      />
      <SageStockExport
        items={stock.items}
        filters={filters}
        total={data?.total ?? 0}
        visible={!activeKey}
      />

      {/* The figures belong to the list: an opened item's page takes their place (the list stays mounted). */}
      <div className={activeKey ? 'hidden' : undefined}>
        <SageStockKpis
          total={data?.total ?? null}
          tabCounts={data?.tabCounts ?? {}}
          tab={filters.tab}
          onTab={(tab) => stock.setFilters({ tab })}
        />
      </div>

      <OpenTabsBar
        tabs={tabs.map((tab) => ({
          id: tab.key,
          label: tab.label,
          kind: 'Stock',
          title: tab.label,
        }))}
        activeId={activeKey}
        navLabel="Open stock items"
        listLabel="All Stock"
        kind="Stock"
        historyLabel="Opened stock items"
        icon={BoxesIcon}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(key) => {
          const tab = tabs.find((candidate) => candidate.key === key)
          if (tab) navigate(tab.path)
        }}
        onClose={closeTab}
        onClear={() => {
          setTabs([])
          if (activeKey) navigate(LIST_PATH)
        }}
      />

      {stockCode && (
        <div className={SCROLL_VIEW}>
          <SageStockDetailsView
            key={`stock-${stockCode}`}
            stockCode={stockCode}
            preview={preview}
            onBack={() => navigate(LIST_PATH)}
            onLoaded={(code) => rename(`stock:${stockCode}`, code)}
          />
        </div>
      )}

      {/* Kept mounted but hidden while an item is open (display: none also removes it from tab order
          and screen readers), so Back finds the search, filters and page as they were. */}
      <div className={activeKey ? 'hidden' : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'}>
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
    </div>
  )
}
