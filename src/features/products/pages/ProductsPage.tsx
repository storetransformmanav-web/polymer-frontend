import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { ProductDetailsView } from '../components/ProductDetailsView.tsx'
import { ProductQuickView } from '../components/ProductQuickView.tsx'
import { ProductTabsBar } from '../components/ProductTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ProductsList } from '../components/ProductsList.tsx'
import { ProductsToolbar } from '../components/ProductsToolbar.tsx'
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
      <ProductTabsBar
        tabs={tabs.tabs}
        activeId={activeId}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => navigate(detailsPath(id))}
        onClose={closeTab}
        onClear={clearTabs}
      />

      {activeId && (
        <ProductDetailsView
          key={activeId}
          id={activeId}
          onBack={() => navigate(LIST_PATH)}
        />
      )}

      {/* Kept mounted but hidden while a product is open (display: none also
          removes it from tab order and screen readers). */}
      <div className={activeId ? 'hidden' : 'flex flex-col gap-4'}>
        <ProductsToolbar
          filters={filters}
          facets={products.facets}
          total={data?.total ?? null}
          hasFilters={products.hasFilters}
          onChange={products.setFilters}
          onReset={products.resetFilters}
        />

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
            onPrefetch={products.prefetchDetails}
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

      {quickView && !activeId && (
        <ProductQuickView
          key={quickView.id}
          product={quickView}
          onClose={closeQuickView}
          onOpenDetails={() => openFromQuickView(quickView)}
        />
      )}
    </div>
  )
}
