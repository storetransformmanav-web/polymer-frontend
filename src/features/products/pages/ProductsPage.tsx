import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import type {
  ProductDetail,
  ProductListItem,
  ProductUpdateBody,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { BulkEditView } from '../components/BulkEditView.tsx'
import { ProductDetailsView } from '../components/ProductDetailsView.tsx'
import { ProductEditPanel } from '../components/ProductEditPanel.tsx'
import { ProductQuickView } from '../components/ProductQuickView.tsx'
import { ProductTabsBar } from '../components/ProductTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ProductsBulkBar } from '../components/ProductsBulkBar.tsx'
import { ProductsList } from '../components/ProductsList.tsx'
import { ProductsToolbar } from '../components/ProductsToolbar.tsx'
import { usePrefetchDetails, type BulkSavedItem } from '../hooks/useBulkEdit.ts'
import { useProductTabs } from '../hooks/useProductTabs.ts'
import { useProducts } from '../hooks/useProducts.ts'

const LIST_PATH = '/products'
const detailsPath = (id: string) => `${LIST_PATH}/${encodeURIComponent(id)}`

/**
 * Products: the catalogue list at `/products`, and one product's details at
 * `/products/:id` — both rendered here, in the same page. Opening a product
 * adds a tab to the strip above; the list stays mounted (just hidden) while
 * you're in a product, so coming back keeps your scroll, filters and page.
 *
 * Data comes from the Redux cache (see productsSlice.ts), which is what
 * makes switching feel instant.
 */
export function ProductsPage() {
  const products = useProducts()
  const tabs = useProductTabs()
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const { filters, data } = products
  // The product whose quick-view side panel is open (opened from a row's image).
  const [quickView, setQuickView] = useState<ProductListItem | null>(null)
  const closeQuickView = useCallback(() => setQuickView(null), [])
  // The product whose edit form is open (from a row's pencil or the details page).
  const [editingId, setEditingId] = useState<string | null>(null)
  // Products edited this session → the push status their save reported (so the
  // details header can track whether the edit reached the store).
  const [savedStatus, setSavedStatus] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const closeEdit = useCallback(() => setEditingId(null), [])
  // Ticked rows (by id) and the products open in the bulk editor, if it is open.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [bulkItems, setBulkItems] = useState<ProductListItem[] | null>(null)
  const prefetchMany = usePrefetchDetails()
  // Only rows on the page being shown count as selected (and get edited).
  const selectedItems = products.items.filter((item) => selected.has(item.id))

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePage(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      for (const item of products.items) {
        if (checked) next.add(item.id)
        else next.delete(item.id)
      }
      return next
    })
  }

  function openBulk(items: ProductListItem[]) {
    if (items.length === 0) return
    setNotice(null)
    setQuickView(null)
    setBulkItems(items)
  }

  function handleBulkSaved(saved: BulkSavedItem[]) {
    setSavedStatus((current) => ({
      ...current,
      ...Object.fromEntries(
        saved.map((item) => [item.product.id, item.result.sync_status]),
      ),
    }))
  }

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [notice])

  function openEdit(id: string) {
    setNotice(null)
    setQuickView(null)
    setEditingId(id)
  }

  function handleSaved(
    result: ProductWriteResult,
    product: ProductDetail,
    body: ProductUpdateBody,
  ) {
    setEditingId(null)
    setSavedStatus((current) => ({ ...current, [product.id]: result.sync_status }))
    // Name the product as it is now (a rename is part of this very edit).
    setNotice(
      `Saved “${body.title ?? product.title}”. ${result.message || 'It is being sent to the store.'}`,
    )
  }

  // `/products/<id>[/…]` → the product id; `/products` → null (the list).
  const activeId = splat ? splat.split('/')[0] || null : null

  function openProduct(product: ProductListItem) {
    tabs.openTab({ id: product.id, handle: product.handle, title: product.title })
    navigate(detailsPath(product.id))
  }

  function openFromQuickView(product: ProductListItem) {
    setQuickView(null)
    openProduct(product)
  }

  function closeTab(id: string) {
    const index = tabs.tabs.findIndex((tab) => tab.id === id)
    const neighbour = tabs.tabs[index + 1] ?? tabs.tabs[index - 1]
    tabs.closeTab(id)
    if (id === activeId) navigate(neighbour ? detailsPath(neighbour.id) : LIST_PATH)
  }

  function clearTabs() {
    tabs.clearTabs()
    if (activeId) navigate(LIST_PATH)
  }

  return (
    <div className="flex flex-col gap-4">
      {bulkItems && (
        <BulkEditView
          key="bulk-edit"
          items={bulkItems}
          onBack={() => setBulkItems(null)}
          onSaved={handleBulkSaved}
        />
      )}

      <ProductTabsBar
        tabs={tabs.tabs}
        activeId={activeId}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => navigate(detailsPath(id))}
        onClose={closeTab}
        onClear={clearTabs}
      />

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      {activeId && (
        <ProductDetailsView
          key={`details-${activeId}`}
          id={activeId}
          onBack={() => navigate(LIST_PATH)}
          onSaved={handleSaved}
          savedStatus={savedStatus[activeId] ?? null}
        />
      )}

      {/* Kept mounted but hidden while a product is open (display: none also
          removes it from tab order and screen readers). */}
      <div className={activeId || bulkItems ? 'hidden' : 'flex flex-col gap-4'}>
        <ProductsToolbar
          filters={filters}
          facets={products.facets}
          total={data?.total ?? null}
          hasFilters={products.hasFilters}
          onChange={products.setFilters}
          onReset={products.resetFilters}
        />

        {!products.isPending && !products.error && products.items.length > 0 && (
          <ProductsBulkBar
            pageCount={products.items.length}
            selectedCount={selectedItems.length}
            onEditPage={() => openBulk(products.items)}
            onEditSelected={() => openBulk(selectedItems)}
            onClearSelection={() => setSelected(new Set())}
            onPrepare={() =>
              prefetchMany(
                (selectedItems.length > 0 ? selectedItems : products.items).map(
                  (item) => item.id,
                ),
              )
            }
          />
        )}

        <section
          aria-label="Products"
          className="border-border bg-bg relative overflow-hidden rounded-2xl border"
        >
          {/* Thin activity bar: results stay on screen while a refresh runs. */}
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
              products.isFetching && !products.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <ProductsList
            items={products.items}
            isPending={products.isPending}
            error={products.error}
            hasFilters={products.hasFilters}
            isStale={products.isShowingPrevious}
            onOpen={openProduct}
            onQuickView={setQuickView}
            onEdit={(product) => openEdit(product.id)}
            onPrefetch={products.prefetchDetails}
            selected={selected}
            onToggleSelected={toggleSelected}
            onTogglePage={togglePage}
            onRetry={products.retry}
            onClearFilters={products.resetFilters}
          />

          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={filters.pageSize}
              total={data.total}
              totalPages={data.total_pages}
              onPageChange={(page) => products.setFilters({ page })}
              onPageSizeChange={(pageSize) => products.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>

      {editingId && (
        <ProductEditPanel
          key={`edit-${editingId}`}
          id={editingId}
          onClose={closeEdit}
          onSaved={handleSaved}
        />
      )}

      {quickView && !activeId && (
        <ProductQuickView
          key={`quick-view-${quickView.id}`}
          product={quickView}
          onClose={closeQuickView}
          onOpenDetails={() => openFromQuickView(quickView)}
        />
      )}
    </div>
  )
}
