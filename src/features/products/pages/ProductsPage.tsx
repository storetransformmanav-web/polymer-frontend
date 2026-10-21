import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import type {
  ProductCreateResult,
  ProductDetail,
  ProductEditStatus,
  ProductListItem,
  ProductUpdateBody,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { BulkEditView } from '../components/BulkEditView.tsx'
import { ConfirmUpdateDialog } from '../components/ConfirmUpdateDialog.tsx'
import { preloadRichTextEditor } from '../../../components/ui/richTextEditorChunk.ts'
import { ProductCreateView } from '../components/ProductCreateView.tsx'
import { ProductDeleteDialog } from '../components/ProductDeleteDialog.tsx'
import { ProductDetailsView } from '../components/ProductDetailsView.tsx'
import { ProductQuickView } from '../components/ProductQuickView.tsx'
import { ProductTabsBar } from '../components/ProductTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ProductsBulkBar } from '../components/ProductsBulkBar.tsx'
import { ProductsList } from '../components/ProductsList.tsx'
import { ProductsToolbar } from '../components/ProductsToolbar.tsx'
import { usePrefetchDetails, type BulkSavedItem } from '../hooks/useBulkEdit.ts'
import { useProductStatusChange } from '../hooks/useProductStatusChange.ts'
import { useProductTabs } from '../hooks/useProductTabs.ts'
import { useRefreshProductList } from '../hooks/useRefreshProductList.ts'
import { statusLabel } from '../utils/format.ts'
import { useProducts } from '../hooks/useProducts.ts'

/**
 * How often, and for how long, to look for the image of a just-created product:
 * every 4 s at first; after 40 s say it is taking long and look every 16 s; stop at 10 min.
 */
const IMAGE_POLL_MS = 4000
const IMAGE_GIVE_UP_MS = 40_000
const IMAGE_SLOW_POLL_MS = 16_000
const IMAGE_STOP_MS = 10 * 60_000

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

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
  // Products edited this session → the push status their save reported (so the
  // details header can track whether the edit reached the store).
  const [savedStatus, setSavedStatus] = useState<Record<string, string>>({})
  const [noticeState, setNoticeState] = useState<{
    text: string
    tone: 'success' | 'info'
  } | null>(null)
  const setNotice = useCallback(
    (text: string | null) => setNoticeState(text ? { text, tone: 'success' } : null),
    [],
  )
  // Ticked rows (by id) and the products open in the bulk editor, if it is open.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [bulkItems, setBulkItems] = useState<ProductListItem[] | null>(null)
  // The "Add product" form is open.
  const [creating, setCreating] = useState(false)
  const prefetchMany = usePrefetchDetails()
  const status = useProductStatusChange()
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

  function openCreate() {
    setNotice(null)
    setQuickView(null)
    setCreating(true)
  }

  function handleCreated(
    result: ProductCreateResult,
    info: { previewUrl: string | null },
  ) {
    setCreating(false)
    // What the store made, as it reports it (the counts are of what it accepted).
    const made = [
      result.variants > 0 ? plural(result.variants, 'variant') : '',
      result.media > 0 ? plural(result.media, 'file') : '',
    ].filter(Boolean)
    setNotice(
      `Created “${result.title}”${made.length ? ` with ${made.join(' and ')}` : ''}. ${result.message || 'It is in your store and in the list below.'}${
        info.previewUrl ? ' Its image is being downloaded by the store.' : ''
      }`,
    )
    if (info.previewUrl) {
      setAwaitingImage({
        id: result.product_id,
        title: result.title,
        previewUrl: info.previewUrl,
      })
    }
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
    if (!noticeState) return undefined
    // A warning that needs reading and acting on stays longer than a confirmation.
    const timer = window.setTimeout(
      () => setNotice(null),
      noticeState.tone === 'info' ? 25_000 : 8000,
    )
    return () => window.clearTimeout(timer)
  }, [noticeState, setNotice])

  // A product created with an image: the store downloads the file first, so the list
  // is re-read every few seconds until the product's own image shows up (or we give up).
  const refreshList = useRefreshProductList()
  const [awaitingImage, setAwaitingImage] = useState<{
    id: string
    title: string
    previewUrl: string
  } | null>(null)
  const awaitedRow = awaitingImage
    ? products.items.find((item) => item.id === awaitingImage.id)
    : undefined
  // The row has an image that is not just the address that was typed in: it has arrived.
  if (
    awaitingImage &&
    awaitedRow?.image_url &&
    awaitedRow.image_url !== awaitingImage.previewUrl
  ) {
    setAwaitingImage(null)
  }
  useEffect(() => {
    if (!awaitingImage) return undefined
    const startedAt = Date.now()
    let ticks = 0
    const poll = window.setInterval(() => {
      const age = Date.now() - startedAt
      if (age > IMAGE_STOP_MS) {
        setAwaitingImage(null)
        return
      }
      ticks += 1
      // Once it is taking long, look less often (every fourth time).
      if (age > IMAGE_GIVE_UP_MS && ticks % (IMAGE_SLOW_POLL_MS / IMAGE_POLL_MS) !== 0) {
        return
      }
      refreshList(false)
    }, IMAGE_POLL_MS)
    // The picture on the row stays (the slice keeps it) while this keeps looking.
    const slow = window.setTimeout(() => {
      setNoticeState({
        tone: 'info',
        text: `“${awaitingImage.title}” was created, but its image hasn't arrived yet. The store needs a direct, public link to an image file — it keeps checking, and if it never appears, add the image again from the product's Media tab.`,
      })
    }, IMAGE_GIVE_UP_MS)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(slow)
    }
  }, [awaitingImage, refreshList])

  // The product a row's trash button asked to delete (the dialog confirms how).
  const [deleting, setDeleting] = useState<ProductListItem | null>(null)
  const closeDelete = useCallback(() => setDeleting(null), [])

  function askDelete(product: ProductListItem) {
    setNotice(null)
    setQuickView(null)
    setDeleting(product)
  }

  function handleDeleted(product: ProductListItem, result: ProductWriteResult) {
    setDeleting(null)
    // What happened, in the backend's own words.
    setNotice(`“${product.title}”: ${result.message || 'Product deleted.'}`)
  }

  // A status picked in the list, waiting for "Yes, update" (it is also changed in Shopify).
  const [statusChange, setStatusChange] = useState<{
    product: ProductListItem
    next: ProductEditStatus
  } | null>(null)

  function askStatusChange(product: ProductListItem, next: ProductEditStatus) {
    if (next === product.status?.toUpperCase()) return
    setStatusChange({ product, next })
  }

  async function changeStatus(product: ProductListItem, next: ProductEditStatus) {
    setStatusChange(null)
    if (next === product.status?.toUpperCase()) return
    const result = await status.change(product, next)
    // Track whether the change reached the store, if this product's details are opened.
    if (result) {
      setSavedStatus((current) => ({ ...current, [product.id]: result.sync_status }))
    }
  }

  function handleSaved(
    result: ProductWriteResult,
    product: ProductDetail,
    body: ProductUpdateBody,
  ) {
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

      {creating && (
        <ProductCreateView
          key="create-product"
          onBack={() => setCreating(false)}
          onCreated={handleCreated}
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

      {noticeState && (
        <FormMessage tone={noticeState.tone}>{noticeState.text}</FormMessage>
      )}

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
      <div
        className={activeId || bulkItems || creating ? 'hidden' : 'flex flex-col gap-4'}
      >
        <ProductsToolbar
          filters={filters}
          facets={products.facets}
          total={data?.total ?? null}
          hasFilters={products.hasFilters}
          onChange={products.setFilters}
          onReset={products.resetFilters}
        />

        {!products.isPending && !products.error && (
          <ProductsBulkBar
            onAdd={openCreate}
            onAddIntent={preloadRichTextEditor}
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
            onStatusChange={askStatusChange}
            statusPending={status.pending}
            statusErrors={status.errors}
            onDelete={askDelete}
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

      {deleting && (
        <ProductDeleteDialog
          key={`delete-${deleting.id}`}
          product={deleting}
          onClose={closeDelete}
          onDone={(result) => handleDeleted(deleting, result)}
        />
      )}

      {statusChange && (
        <ConfirmUpdateDialog
          key={`status-${statusChange.product.id}`}
          title={`Change “${statusChange.product.title}” to ${statusLabel(statusChange.next)}?`}
          onConfirm={() => void changeStatus(statusChange.product, statusChange.next)}
          onCancel={() => setStatusChange(null)}
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
