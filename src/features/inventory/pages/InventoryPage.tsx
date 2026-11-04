import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { HistoryIcon } from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { InventoryItem, InventorySort } from '../../../lib/api/endpoints.ts'
import { InventoryKpis } from '../components/InventoryKpis.tsx'
import { InventoryList } from '../components/InventoryList.tsx'
import { InventoryTabsBar } from '../components/InventoryTabsBar.tsx'
import { InventoryToolbar } from '../components/InventoryToolbar.tsx'
import { StockEditDialog } from '../components/StockEditDialog.tsx'
import { StockHistoryView } from '../components/StockHistoryView.tsx'
import type { StockEditRequest } from '../components/StockTable.tsx'
import { SyncNotices } from '../components/SyncNotices.tsx'
import { VariantStockView } from '../components/VariantStockView.tsx'
import { useInventory } from '../hooks/useInventory.ts'
import { useInventoryTabs } from '../hooks/useInventoryTabs.ts'
import { HISTORY_PATH, LIST_PATH, variantPath } from '../utils/format.ts'

// An open variant / the history scroll inside the page (from `lg` up the page itself does not
// scroll — see `fillHeight` in navigation.ts).
const SCROLL_VIEW = 'lg:min-h-0 lg:flex-1 lg:overflow-y-auto'

/**
 * Inventory: the stock list at `/inventory`, one variant's stock at `/inventory/:variantId` and
 * the stock history at `/inventory/history` — all rendered here, in the same page, built like
 * Products. Opening a variant adds a tab to the strip above; the list stays mounted (just hidden)
 * while you are in a variant, so coming back keeps its filters and page.
 *
 * Data comes from the Redux cache (see inventorySlice.ts): nothing waits on a loader once a page
 * has been seen, and a stock edit changes every figure at once while it goes to Shopify.
 */
export function InventoryPage() {
  const inventory = useInventory()
  const tabs = useInventoryTabs()
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const { filters, data } = inventory
  // The edit window opened from the list: the variant and where it starts.
  const [editing, setEditing] = useState<{
    item: InventoryItem
    request: StockEditRequest
  } | null>(null)

  // `/inventory/<id>[/…]` → the variant id; `/inventory/history` → the history; else the list.
  const first = splat ? splat.split('/')[0] || null : null
  const showHistory = first === 'history'
  const activeId = showHistory ? null : first
  const onList = !activeId && !showHistory

  function closeTab(id: string) {
    const index = tabs.tabs.findIndex((tab) => tab.id === id)
    const neighbour = tabs.tabs[index + 1] ?? tabs.tabs[index - 1]
    tabs.closeTab(id)
    if (id === activeId) navigate(neighbour ? variantPath(neighbour.id) : LIST_PATH)
  }

  function clearTabs() {
    tabs.clearTabs()
    if (activeId) navigate(LIST_PATH)
  }

  function openVariant(item: InventoryItem) {
    tabs.openTab({
      id: item.variant_id,
      title: item.title,
      variantTitle: item.variant_title ?? null,
    })
    navigate(variantPath(item.variant_id))
  }

  const threshold = Number.parseInt(filters.lowThreshold, 10)

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      {/* The figures belong to the list: a variant and the history take their place. */}
      <div className={onList ? undefined : 'hidden'}>
        {/* The figures without a stock status, so choosing "Out of stock" doesn't zero "In stock". */}
        <InventoryKpis
          totals={inventory.baseTotals ?? inventory.totals}
          variants={data?.total ?? null}
        />
      </div>

      <InventoryTabsBar
        tabs={tabs.tabs}
        activeId={activeId}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => navigate(variantPath(id))}
        onClose={closeTab}
        onClear={clearTabs}
      />

      <SyncNotices />

      {activeId && (
        <div className={SCROLL_VIEW}>
          <VariantStockView
            key={`variant-${activeId}`}
            id={activeId}
            onBack={() => navigate(LIST_PATH)}
          />
        </div>
      )}

      {showHistory && (
        <div className={SCROLL_VIEW}>
          <StockHistoryView
            locations={inventory.locations}
            onBack={() => navigate(LIST_PATH)}
          />
        </div>
      )}

      {/* Kept mounted but hidden while a variant or the history is open (display: none also
          removes it from tab order and screen readers). */}
      <div className={onList ? 'flex flex-col gap-4 lg:min-h-0 lg:flex-1' : 'hidden'}>
        <InventoryToolbar
          filters={filters}
          locations={inventory.locations}
          counts={inventory.baseTotals}
          hasFilters={inventory.hasFilters}
          onChange={inventory.setFilters}
          onReset={inventory.resetFilters}
          actions={
            <button
              type="button"
              onClick={() => navigate(HISTORY_PATH)}
              className="border-border bg-bg text-text hover:border-accent flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors"
            >
              <HistoryIcon width={16} height={16} />
              Stock history
            </button>
          }
        />

        <section
          aria-label="Inventory"
          className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
        >
          {/* Thin activity bar: results stay on screen while a refresh runs. */}
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
              inventory.isFetching && !inventory.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <HighlightQuery query={filters.search}>
            <InventoryList
              items={inventory.items}
              isPending={inventory.isPending}
              error={inventory.error}
              hasFilters={inventory.hasFilters}
              isStale={inventory.isShowingPrevious}
              threshold={Number.isFinite(threshold) ? threshold : 10}
              sort={filters.sort}
              order={filters.order}
              // A new column starts ascending; the same column flips direction.
              onSort={(sort: InventorySort) =>
                inventory.setFilters(
                  sort === filters.sort
                    ? { order: filters.order === 'asc' ? 'desc' : 'asc' }
                    : { sort, order: 'asc' },
                )
              }
              onOpen={openVariant}
              onPrefetch={inventory.prefetchDetails}
              onEdit={(item, request) => setEditing({ item, request })}
              onRetry={inventory.retry}
              onClearFilters={inventory.resetFilters}
            />
          </HighlightQuery>

          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={filters.pageSize}
              total={data.total}
              totalPages={data.total_pages}
              onPageChange={(page) => inventory.setFilters({ page })}
              onPageSizeChange={(pageSize) => inventory.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>

      {editing && (
        <StockEditDialog
          key={`edit-${editing.item.variant_id}-${editing.request.locationId}-${editing.request.mode}`}
          variant={editing.item}
          locationId={editing.request.locationId || undefined}
          mode={editing.request.mode}
          quantity={editing.request.quantity}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
