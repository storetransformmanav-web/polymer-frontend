import { useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, ArrowLeftIcon } from '../../../components/ui/icons.tsx'
import { useProductDetails } from '../hooks/useProductDetails.ts'
import { statusLabel, statusTone } from '../utils/format.ts'
import { CopyButton } from './CopyButton.tsx'
import {
  CollectionsPanel,
  InventoryPanel,
  MediaPanel,
  MetafieldsPanel,
  OverviewPanel,
  PanelSkeleton,
  RawPanel,
  SeoPanel,
  VariantsPanel,
} from './ProductDetailPanels.tsx'
import { ProductImage } from './ProductImage.tsx'

type TabId =
  | 'overview'
  | 'variants'
  | 'inventory'
  | 'collections'
  | 'media'
  | 'seo'
  | 'metafields'
  | 'raw'

interface ProductDetailsViewProps {
  id: string
  onBack: () => void
}

/**
 * A product's full details, shown in place of the list (same page, no
 * overlay). The header draws straight from the list row while the full
 * record loads, so nothing waits on the network when you come from the
 * list.
 */
export function ProductDetailsView({ id, onBack }: ProductDetailsViewProps) {
  const details = useProductDetails(id)
  const { product, preview } = details
  const [tab, setTab] = useState<TabId>('overview')
  const { loadRaw } = details

  // The raw Shopify payload is big, so only fetch it when its tab opens.
  useEffect(() => {
    if (tab === 'raw') loadRaw()
  }, [tab, loadRaw])

  const title = product?.title ?? preview?.title ?? 'Loading product…'
  const status = product?.status ?? preview?.status
  const vendor = product?.vendor ?? preview?.vendor
  const imageUrl =
    product?.featured_image_url ?? product?.images[0]?.url ?? preview?.image_url ?? null
  const firstSku = product?.variants.find((variant) => variant.sku)?.sku
  const extraVariants = product ? Math.max(0, product.variants.length - 1) : 0

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
    { id: 'raw', label: 'Raw data' },
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
          <ProductImage src={imageUrl} alt="" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-snug font-bold break-words sm:text-2xl">
              {title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]">
              {status && (
                <Badge tone={statusTone(status)}>
                  <span
                    aria-hidden="true"
                    className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current"
                  />
                  {statusLabel(status)}
                </Badge>
              )}
              {firstSku && (
                <span className="flex items-center gap-1.5">
                  <span className="text-text-muted">SKU</span>
                  <span className="bg-accent-tint rounded-md px-1.5 py-0.5 font-mono text-[0.8rem]">
                    {firstSku}
                  </span>
                  <CopyButton value={firstSku} label={`Copy ${firstSku}`} />
                  {extraVariants > 0 && (
                    <span className="text-text-muted text-[0.78rem] whitespace-nowrap">
                      +{extraVariants} more
                    </span>
                  )}
                </span>
              )}
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
        {tab === 'overview' && <OverviewPanel product={product} preview={preview} />}
        {tab !== 'overview' && tab !== 'raw' && !product && <PanelSkeleton />}
        {product && tab === 'variants' && <VariantsPanel product={product} />}
        {product && tab === 'inventory' && <InventoryPanel product={product} />}
        {product && tab === 'collections' && <CollectionsPanel product={product} />}
        {product && tab === 'media' && <MediaPanel product={product} />}
        {product && tab === 'seo' && <SeoPanel product={product} />}
        {product && tab === 'metafields' && <MetafieldsPanel product={product} />}
        {tab === 'raw' && (
          <RawPanel
            raw={details.raw}
            isLoading={details.isRawLoading}
            error={details.rawError}
            onRetry={details.loadRaw}
          />
        )}
      </div>
    </article>
  )
}
