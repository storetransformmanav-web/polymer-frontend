import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  TagIcon,
  XCircleIcon,
} from '../../../components/ui/icons.tsx'
import type { ProductDetail, ProductEditStatus } from '../../../lib/api/endpoints.ts'
import { useLocalMediaSync } from '../hooks/useLocalMedia.ts'
import { usePendingMediaSync } from '../hooks/usePendingMedia.ts'
import { useProductDetails } from '../hooks/useProductDetails.ts'
import { useProductStatusChange } from '../hooks/useProductStatusChange.ts'
import type { SavedHandler } from '../hooks/useSectionEdit.ts'
import { ConfirmUpdateDialog } from './ConfirmUpdateDialog.tsx'
import { ProductStatusSelect } from './ProductStatusSelect.tsx'
import { ProductSyncStatus } from './ProductSyncStatus.tsx'
import {
  formatPriceRange,
  formatRange,
  statusLabel,
  statusTone,
} from '../utils/format.ts'
import {
  CollectionsPanel,
  InventoryPanel,
  MediaPanel,
  MetafieldsPanel,
  OverviewPanel,
  SeoPanel,
  VariantsPanel,
} from './ProductDetailPanels.tsx'
import { ProductImage } from './ProductImage.tsx'
import { DetailSkeleton as PanelSkeleton } from '../../../components/ui/DetailSection.tsx'

type TabId =
  'overview' | 'variants' | 'inventory' | 'collections' | 'media' | 'seo' | 'metafields'

interface ProductDetailsViewProps {
  id: string
  onBack: () => void
  /** Called after any section of this product is saved in place (the page shows the notice). */
  onSaved?: SavedHandler
  /**
   * The push status reported by the last edit saved here, or null if this
   * product wasn't edited this session. While set, the header tracks whether
   * the edit reached the store.
   */
  savedStatus?: string | null
}

/**
 * A product's full details, shown in place of the list (same page, no
 * overlay). The header draws straight from the list row while the full
 * record loads, so nothing waits on the network when you come from the
 * list.
 */
export function ProductDetailsView({
  id,
  onBack,
  onSaved,
  savedStatus = null,
}: ProductDetailsViewProps) {
  const details = useProductDetails(id)
  const { product, preview } = details
  // Pictures just chosen from the computer wait here for the store's copies (see useLocalMedia).
  useLocalMediaSync(product)
  // Files the store is still processing (also remembered across a page refresh) are looked for
  // on whichever tab is open, not only on the Media tab.
  usePendingMediaSync(product)
  const [tab, setTab] = useState<TabId>('overview')
  // The status picked in the header, waiting for "Yes, update" (it is also changed in Shopify).
  const statusChange = useProductStatusChange()
  const [askedStatus, setAskedStatus] = useState<ProductEditStatus | null>(null)

  async function changeStatus(current: ProductDetail, next: ProductEditStatus) {
    setAskedStatus(null)
    const result = await statusChange.change(current, next)
    if (result) onSaved?.(result, current, { status: next })
  }

  // The push history needs the product's store, known from the list row or the loaded record.
  const shop = product?.shop?.key ?? preview?.shop?.key

  const title = product?.title ?? preview?.title ?? 'Loading product…'
  const status = product?.status ?? preview?.status
  const vendor = product?.vendor ?? preview?.vendor
  const imageUrl =
    product?.featured_image_url ?? product?.images[0]?.url ?? preview?.image_url ?? null

  // Price and stock come from the full record when it's loaded, otherwise
  // from the list row, so the header is complete the moment the page opens.
  const currency = product?.currency ?? preview?.currency
  const price = product?.price_range
    ? formatRange(product.price_range.min, product.price_range.max, currency)
    : preview
      ? formatPriceRange(preview)
      : '—'
  const compareAt = product?.compare_at_price_range
  const stock = (product ? product.total_inventory : preview?.total_inventory) ?? null

  const inventoryLevels = product?.variants.reduce(
    (sum, variant) => sum + variant.inventory_levels.length,
    0,
  )
  const metafieldCount = product
    ? product.metafields.length +
      product.variants.reduce((sum, variant) => sum + variant.metafields.length, 0)
    : 0

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'variants', label: 'Variants', count: product?.variants.length },
    { id: 'inventory', label: 'Inventory', count: inventoryLevels },
    { id: 'collections', label: 'Collections', count: product?.collections.length },
    { id: 'media', label: 'Media', count: product?.images.length },
    { id: 'seo', label: 'SEO & Online' },
    ...(metafieldCount > 0
      ? [{ id: 'metafields' as const, label: 'Metafields', count: metafieldCount }]
      : []),
  ]

  if (details.error) {
    return (
      <section className="border-border bg-bg flex flex-col items-center gap-3 rounded-2xl border px-4 py-16 text-center">
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="font-semibold">Couldn&apos;t load this product</p>
          <p className="text-text-muted text-[0.9rem]">{details.error}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={details.retry}
            className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onBack}
            className="border-border bg-bg text-text-muted hover:text-text cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Back to list
          </button>
        </div>
      </section>
    )
  }

  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border">
      <header className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <ProductImage src={imageUrl} alt="" productId={id} />
          <div className="min-w-0 flex-1">
            {/* Name, then stock and price right beside it (they wrap below on narrow screens). */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <h1 className="text-lg leading-snug font-bold break-words sm:text-2xl">
                {title}
              </h1>

              <dl className="flex flex-col gap-y-2 lg:flex-row lg:flex-wrap lg:items-center">
                <div className="border-border flex items-center gap-2 lg:border-l lg:pl-5">
                  <dt className="sr-only">Total stock</dt>
                  <dd className="flex items-center gap-2 whitespace-nowrap">
                    {stock === null ? (
                      <span className="text-text-muted">—</span>
                    ) : stock <= 0 ? (
                      <>
                        <XCircleIcon
                          width={20}
                          height={20}
                          className="text-danger shrink-0"
                        />
                        <span className="text-danger font-semibold">Out of stock</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon
                          width={20}
                          height={20}
                          className="text-accent shrink-0"
                        />
                        <span className="font-semibold">
                          {stock.toLocaleString('en-GB')}
                        </span>
                        <span className="text-text-muted text-[0.85rem]">in stock</span>
                      </>
                    )}
                  </dd>
                </div>

                <div className="border-border flex flex-wrap items-center gap-x-2 lg:ml-5 lg:border-l lg:pl-5">
                  <dt className="sr-only">Price</dt>
                  <dd className="flex items-center gap-2 whitespace-nowrap">
                    <TagIcon
                      width={20}
                      height={20}
                      className="text-text-muted shrink-0"
                    />
                    <span className="text-lg font-bold tracking-tight">{price}</span>
                  </dd>
                  {compareAt?.min && (
                    <dd className="text-text-muted text-[0.8rem] whitespace-nowrap">
                      <span className="sr-only">Compare at </span>
                      <span className="line-through">
                        {formatRange(compareAt.min, compareAt.max, currency)}
                      </span>
                    </dd>
                  )}
                </div>
              </dl>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]">
              {status &&
                (product ? (
                  <ProductStatusSelect
                    title={product.title}
                    value={statusChange.pending[id] ?? status}
                    saving={id in statusChange.pending}
                    error={statusChange.errors[id]}
                    onChange={(next) => {
                      if (next !== status.toUpperCase()) setAskedStatus(next)
                    }}
                  />
                ) : (
                  <Badge tone={statusTone(status)}>
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current"
                    />
                    {statusLabel(status)}
                  </Badge>
                ))}
              {vendor && (
                <span>
                  <span className="text-text-muted">Vendor </span>
                  <span className="font-semibold">{vendor}</span>
                </span>
              )}
              {details.isRefreshing && (
                <span className="text-text-muted text-[0.75rem]" role="status">
                  Updating…
                </span>
              )}
              {savedStatus !== null && (
                <ProductSyncStatus id={id} shop={shop} initialStatus={savedStatus} />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to list"
            className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            <ArrowLeftIcon width={16} height={16} />
            <span className="hidden sm:inline" aria-hidden="true">
              Back to list
            </span>
          </button>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Product sections"
        className="border-border flex [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`product-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="product-tabpanel"
              onClick={() => setTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[0.85rem] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? 'border-accent text-text'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="bg-surface text-text-muted border-border rounded-full border px-1.5 py-0.5 text-[0.68rem] font-bold">
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id="product-tabpanel"
        role="tabpanel"
        aria-labelledby={`product-tab-${tab}`}
        className="bg-surface p-3 sm:p-5"
      >
        {tab === 'overview' && (
          <OverviewPanel product={product} preview={preview} onSaved={onSaved} />
        )}
        {tab !== 'overview' && !product && <PanelSkeleton />}
        {product && tab === 'variants' && (
          <VariantsPanel product={product} onSaved={onSaved} />
        )}
        {product && tab === 'inventory' && <InventoryPanel product={product} />}
        {product && tab === 'collections' && (
          <CollectionsPanel product={product} onSaved={onSaved} />
        )}
        {product && tab === 'media' && <MediaPanel product={product} onSaved={onSaved} />}
        {product && tab === 'seo' && <SeoPanel product={product} onSaved={onSaved} />}
        {product && tab === 'metafields' && <MetafieldsPanel product={product} />}
      </div>

      {askedStatus && product && (
        <ConfirmUpdateDialog
          title={`Change “${product.title}” to ${statusLabel(askedStatus)}?`}
          onConfirm={() => void changeStatus(product, askedStatus)}
          onCancel={() => setAskedStatus(null)}
        />
      )}
    </article>
  )
}
