import { ProductDrawer } from '../components/ProductDrawer.tsx'
import { ProductsFooter } from '../components/ProductsFooter.tsx'
import { ProductsList } from '../components/ProductsList.tsx'
import { ProductsToolbar } from '../components/ProductsToolbar.tsx'
import { RecentProductsBar } from '../components/RecentProductsBar.tsx'
import { useProducts } from '../hooks/useProducts.ts'

/**
 * Products catalogue, backed by GET /products. Filtering, sorting and
 * paging all happen on the server; the Redux cache (see productsSlice.ts)
 * is what makes moving between pages and filters feel instant.
 */
export function ProductsPage() {
  const products = useProducts()
  const { filters, data } = products

  return (
    <div className="flex flex-col gap-4">
      <RecentProductsBar
        recent={products.recent}
        selectedId={products.selected?.id ?? null}
        onOpen={products.openProduct}
        onClear={products.clearRecent}
      />

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
          selectedId={products.selected?.id ?? null}
          onOpen={products.openProduct}
          onRetry={products.retry}
          onClearFilters={products.resetFilters}
        />

        {data && data.total > 0 && (
          <ProductsFooter
            page={data.page}
            pageSize={filters.pageSize}
            total={data.total}
            totalPages={data.total_pages}
            onPageChange={(page) => products.setFilters({ page })}
            onPageSizeChange={(pageSize) => products.setFilters({ pageSize })}
          />
        )}
      </section>

      {products.selected && (
        <ProductDrawer
          key={products.selected.id}
          product={products.selected}
          onClose={products.closeProduct}
        />
      )}
    </div>
  )
}
