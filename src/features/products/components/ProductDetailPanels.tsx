import { useMemo, useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
  BoxesIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  SearchIcon,
} from '../../../components/ui/icons.tsx'
import type {
  ProductDetail,
  ProductListItem,
  ProductVariant,
} from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice } from '../../../lib/format.ts'
import { htmlToText, safeUrl, statusLabel, statusTone } from '../utils/format.ts'
import { toSlides, type LightboxSlide } from '../utils/slides.ts'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_CARD as CARD,
  DETAIL_TD as TD,
  DETAIL_TH as TH,
  DetailEmpty as Empty,
  DetailSection,
  DetailSkeleton as PanelSkeleton,
  RawJsonPanel as RawPanel,
  DetailTable as TableWrap,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import { ProductImage } from './ProductImage.tsx'
import { ProductLightbox } from './ProductLightbox.tsx'

const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? null : value ? 'Yes' : 'No'
const date = (value: string | null | undefined) => (value ? formatDate(value) : null)
const num = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

function ExternalLink({
  href,
  children,
}: {
  href: string | null | undefined
  children: ReactNode
}) {
  const safe = safeUrl(href)
  if (!safe) return null
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:text-accent-hover inline-flex max-w-full items-center gap-1.5 font-medium break-all"
    >
      {children}
      <ExternalLinkIcon width={14} height={14} className="shrink-0" />
    </a>
  )
}

// --- Overview --------------------------------------------------------------

/** The spec rows shown in Overview. */
function getSpecs(product: ProductDetail): [string, ReactNode][] {
  return [
    ['Vendor / Brand', product.vendor],
    ['Product type', product.product_type],
    ['Category', product.category?.full_path ?? product.category?.name],
    [
      'Handle',
      <span key="handle" className="flex items-center gap-1.5 font-mono text-[0.85rem]">
        <span className="min-w-0 break-all">{product.handle}</span>
        <CopyButton value={product.handle} label="Copy handle" />
      </span>,
    ],
    ['Shopify ID', product.shopify_id],
    ['Variants', num(product.variants_count ?? product.variants.length)],
    ['Media', num(product.media_count ?? product.images.length)],
    ['Gift card', yesNo(product.gift_card)],
    ['Tracks inventory', yesNo(product.tracks_inventory)],
    ['Single variant', yesNo(product.has_only_default_variant)],
    ['Requires selling plan', yesNo(product.requires_selling_plan)],
    ['Template', product.template_suffix],
  ]
}

interface OverviewProps {
  product: ProductDetail | null
  preview: ProductListItem | null
}

export function OverviewPanel({ product, preview }: OverviewProps) {
  const title = product?.title ?? preview?.title ?? ''
  const imageUrl =
    product?.featured_image_url ?? product?.images[0]?.url ?? preview?.image_url ?? null
  const heroSrc = safeUrl(imageUrl)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const description = useMemo(() => htmlToText(product?.description_html), [product])

  // The lightbox pages through every product image. The hero image is normally
  // one of them; if it isn't (still loading, or a featured image that isn't in
  // the list) it's put first so "View Full" always opens on what's shown.
  const gallery = useMemo(
    () => (product ? toSlides(product.images, title) : []),
    [product, title],
  )
  const hero: LightboxSlide | null = heroSrc ? { src: heroSrc, alt: title } : null
  const heroInGallery = hero !== null && gallery.some((slide) => slide.src === hero.src)
  const slides = hero && !heroInGallery ? [hero, ...gallery] : gallery
  const offset = slides.length - gallery.length
  const heroIndex = hero ? slides.findIndex((slide) => slide.src === hero.src) : -1

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className={`${CARD} relative p-3`}>
          {heroIndex >= 0 ? (
            <>
              <button
                type="button"
                onClick={() => setLightboxIndex(heroIndex)}
                aria-label={`View ${title} full size`}
                className="focus-visible:outline-accent block w-full cursor-zoom-in rounded-xl border-none bg-transparent p-0 focus-visible:outline-2"
              >
                <ProductImage src={imageUrl} alt={title} size="xl" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxIndex(heroIndex)}
                className="border-border bg-bg text-text hover:border-accent absolute right-6 bottom-6 flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.78rem] font-semibold shadow-sm transition-colors"
              >
                <ExternalLinkIcon width={14} height={14} />
                View Full
              </button>
            </>
          ) : (
            <ProductImage src={imageUrl} alt={title} size="xl" />
          )}
        </div>

        {gallery.length > 0 && (
          <ul aria-label="Product media" className={`${CARD} grid grid-cols-4 gap-2 p-3`}>
            {gallery.map((slide, index) => (
              <li key={`${slide.src}-${index}`}>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index + offset)}
                  aria-label={`Open image ${index + 1} of ${gallery.length}`}
                  className="hover:border-accent focus-visible:outline-accent block w-full cursor-zoom-in overflow-hidden rounded-lg border border-transparent bg-transparent p-0 transition-colors focus-visible:outline-2"
                >
                  <ProductImage src={slide.src} alt={slide.alt} size="thumb" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <ProductLightbox
          slides={slides}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      </div>

      {!product ? (
        <PanelSkeleton />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <DetailSection
            title="Product Specifications"
            count={getSpecs(product).length}
            icon={LayersIcon}
          >
            <FieldGrid>
              {getSpecs(product).map(([label, value]) => (
                <Field key={label} label={label}>
                  {value}
                </Field>
              ))}
            </FieldGrid>
            {product.tags.length > 0 && (
              <section aria-labelledby="product-tags-heading" className="mt-5">
                <h3
                  id="product-tags-heading"
                  className="mb-2 text-[0.9rem] font-semibold"
                >
                  Tags
                </h3>
                <ul className="border-border bg-bg flex flex-wrap gap-1.5 rounded-xl border p-2.5">
                  {product.tags.map((tag) => (
                    <li
                      key={tag}
                      className="bg-surface text-text border-border rounded-md border px-2.5 py-1 text-[0.8rem] font-medium"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </DetailSection>

          <DetailSection
            title="Status & Launch"
            count={6}
            icon={ListChecksIcon}
            defaultOpen={false}
          >
            <FieldGrid>
              <Field label="Status">
                <Badge tone={statusTone(product.status)}>
                  {statusLabel(product.status)}
                </Badge>
              </Field>
              <Field label="Published">
                {date(product.published_at) ?? 'Not published'}
              </Field>
              <Field label="Out-of-stock variants">
                {yesNo(product.has_out_of_stock_variants)}
              </Field>
              <Field label="Created">{date(product.shopify_created_at)}</Field>
              <Field label="Updated">{date(product.shopify_updated_at)}</Field>
              <Field label="Last synced">{date(product.synced_at)}</Field>
            </FieldGrid>
          </DetailSection>

          <DetailSection title="Description" icon={CheckCircleIcon} defaultOpen={false}>
            {description ? (
              <p className="text-[0.9rem] leading-relaxed whitespace-pre-line">
                {description}
              </p>
            ) : (
              <p className="text-text-muted text-[0.9rem]">No description.</p>
            )}
          </DetailSection>
        </div>
      )}
    </div>
  )
}

// --- Variants ----------------------------------------------------------------

function weightLabel(variant: ProductVariant): string {
  const weight = Number.parseFloat(variant.weight ?? '')
  if (!Number.isFinite(weight) || weight === 0) return '—'
  return `${weight} ${(variant.weight_unit ?? '').toLowerCase()}`.trim()
}

export function VariantsPanel({ product }: { product: ProductDetail }) {
  if (product.variants.length === 0) {
    return <Empty icon={BoxesIcon}>This product has no variants.</Empty>
  }

  return (
    <div className="flex flex-col gap-4">
      {product.options.length > 0 && !product.has_only_default_variant && (
        <ul className="flex flex-wrap gap-2">
          {product.options.map((option) => (
            <li key={option.name} className={`${CARD} px-3 py-2 text-[0.82rem]`}>
              <span className="text-text-muted font-semibold">{option.name}: </span>
              {option.values.join(', ')}
            </li>
          ))}
        </ul>
      )}

      <TableWrap>
        <thead>
          <tr>
            <th className={TH}>Variant</th>
            <th className={TH}>SKU</th>
            <th className={TH}>Barcode</th>
            <th className={`${TH} text-right`}>Price</th>
            <th className={`${TH} text-right`}>Compare at</th>
            <th className={`${TH} text-right`}>Stock</th>
            <th className={TH}>Availability</th>
            <th className={TH}>Weight</th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((variant) => (
            <tr
              key={variant.id}
              className="border-border even:bg-surface border-b last:border-b-0"
            >
              <td className={TD}>
                <span
                  className="block max-w-64 truncate font-medium"
                  title={variant.title ?? ''}
                >
                  {variant.title ?? '—'}
                </span>
              </td>
              <td className={TD}>
                {variant.sku ? (
                  <span className="flex items-center gap-1.5 font-mono text-[0.8rem]">
                    {variant.sku}
                    <CopyButton value={variant.sku} label={`Copy ${variant.sku}`} />
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className={`${TD} font-mono text-[0.8rem]`}>
                {variant.barcode || '—'}
              </td>
              <td className={`${TD} text-right font-semibold`}>
                {formatPrice(variant.price, variant.currency ?? product.currency)}
              </td>
              <td className={`${TD} text-right`}>
                {variant.compare_at_price
                  ? formatPrice(
                      variant.compare_at_price,
                      variant.currency ?? product.currency,
                    )
                  : '—'}
              </td>
              <td
                className={`${TD} text-right ${
                  (variant.inventory_quantity ?? 1) <= 0
                    ? 'text-danger font-semibold'
                    : ''
                }`}
              >
                {num(variant.inventory_quantity)}
              </td>
              <td className={TD}>
                {variant.available_for_sale === null ||
                variant.available_for_sale === undefined ? (
                  '—'
                ) : (
                  <Badge tone={variant.available_for_sale ? 'success' : 'neutral'}>
                    {variant.available_for_sale ? 'Available' : 'Unavailable'}
                  </Badge>
                )}
              </td>
              <td className={TD}>{weightLabel(variant)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  )
}

// --- Inventory ---------------------------------------------------------------

export function InventoryPanel({ product }: { product: ProductDetail }) {
  const withLevels = product.variants.filter(
    (variant) => variant.inventory_levels.length > 0,
  )
  if (withLevels.length === 0) {
    return (
      <Empty icon={BoxesIcon}>No inventory levels are tracked for this product.</Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {withLevels.map((variant) => (
        <section key={variant.id}>
          <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[0.9rem] font-semibold">
            {variant.title ?? 'Variant'}
            {variant.sku && (
              <span className="text-text-muted font-mono text-[0.78rem] font-normal">
                {variant.sku}
              </span>
            )}
          </h3>
          <TableWrap>
            <thead>
              <tr>
                <th className={TH}>Location</th>
                <th className={`${TH} text-right`}>Available</th>
                <th className={`${TH} text-right`}>On hand</th>
                <th className={`${TH} text-right`}>Committed</th>
                <th className={`${TH} text-right`}>Incoming</th>
                <th className={TH}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {variant.inventory_levels.map((level) => (
                <tr
                  key={level.location_shopify_id}
                  className="border-border even:bg-surface border-b last:border-b-0"
                >
                  <td className={TD}>
                    <span
                      className="block max-w-80 truncate"
                      title={level.location_name ?? ''}
                    >
                      {level.location_name ?? `Location ${level.location_shopify_id}`}
                    </span>
                  </td>
                  <td className={`${TD} text-right font-semibold`}>
                    {num(level.available)}
                  </td>
                  <td className={`${TD} text-right`}>{num(level.on_hand)}</td>
                  <td className={`${TD} text-right`}>{num(level.committed)}</td>
                  <td className={`${TD} text-right`}>{num(level.incoming)}</td>
                  <td className={TD}>{date(level.shopify_updated_at) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </section>
      ))}
    </div>
  )
}

// --- Collections / Media -------------------------------------------------------

/** Shopify calls manually curated collections "custom"; the CRM shows them as "Manual". */
function collectionTypeLabel(type: string): string {
  return type.toLowerCase() === 'custom' ? 'Manual' : statusLabel(type)
}

/** Show a filter box once there are enough collections to need one. */
const COLLECTION_FILTER_MIN = 6

export function CollectionsPanel({ product }: { product: ProductDetail }) {
  const [query, setQuery] = useState('')
  const { collections } = product

  const counts = useMemo(() => {
    const byType = new Map<string, number>()
    for (const collection of collections) {
      const label = collection.collection_type
        ? collectionTypeLabel(collection.collection_type)
        : 'Other'
      byType.set(label, (byType.get(label) ?? 0) + 1)
    }
    return [...byType.entries()]
  }, [collections])

  if (collections.length === 0) {
    return <Empty icon={LayersIcon}>This product isn&apos;t in any collection.</Empty>
  }

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? collections.filter(
        (collection) =>
          collection.title.toLowerCase().includes(needle) ||
          collection.handle.toLowerCase().includes(needle),
      )
    : collections

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.95rem] font-semibold">
            In {collections.length}{' '}
            {collections.length === 1 ? 'collection' : 'collections'}
          </p>
          {counts.map(([label, count]) => (
            <Badge key={label} tone={label === 'Smart' ? 'default' : 'neutral'}>
              {count} {label}
            </Badge>
          ))}
        </div>

        {collections.length >= COLLECTION_FILTER_MIN && (
          <div className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex h-9 w-full items-center gap-2 rounded-lg border px-3 focus-within:outline-2 sm:w-64">
            <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
            <input
              type="search"
              aria-label="Filter collections"
              placeholder="Filter collections…"
              maxLength={100}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-text-muted py-8 text-center text-[0.9rem]">
          No collections match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visible.map((collection) => (
            <li
              key={collection.id}
              className={`${CARD} hover:border-accent flex items-center gap-3.5 p-3.5 transition-colors`}
            >
              <span className="bg-accent-tint text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <LayersIcon width={20} height={20} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[0.92rem] leading-snug font-semibold">
                  {collection.title}
                </p>
                <p className="text-text-muted mt-0.5 flex items-center gap-1.5 text-[0.76rem]">
                  <span className="min-w-0 truncate font-mono" title={collection.handle}>
                    {collection.handle}
                  </span>
                  <CopyButton
                    value={collection.handle}
                    label={`Copy handle ${collection.handle}`}
                  />
                </p>
              </div>

              {collection.collection_type && (
                <Badge
                  tone={
                    collection.collection_type.toLowerCase() === 'smart'
                      ? 'default'
                      : 'neutral'
                  }
                >
                  {collectionTypeLabel(collection.collection_type)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MediaPanel({ product }: { product: ProductDetail }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const slides = useMemo(
    () => toSlides(product.images, product.title),
    [product.images, product.title],
  )

  if (slides.length === 0) {
    return <Empty icon={ImageIcon}>This product has no images.</Empty>
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {slides.map((slide, index) => (
          <li key={`${slide.src}-${index}`} className={`${CARD} overflow-hidden`}>
            <button
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`Open image ${index + 1} of ${slides.length}`}
              className="focus-visible:outline-accent block w-full cursor-zoom-in border-none bg-transparent p-0 focus-visible:outline-2"
            >
              <ProductImage src={slide.src} alt={slide.alt} size="xl" />
            </button>
            <p className="text-text-muted truncate px-3 py-2 text-[0.75rem]">
              {slide.width && slide.height ? `${slide.width} × ${slide.height}` : 'Image'}
            </p>
          </li>
        ))}
      </ul>

      <ProductLightbox
        slides={slides}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </>
  )
}

// --- SEO & online store ---------------------------------------------------------

export function SeoPanel({ product }: { product: ProductDetail }) {
  return (
    <DetailSection title="SEO & Online Store" count={5} icon={ExternalLinkIcon}>
      <FieldGrid>
        <Field label="SEO title">{product.seo?.title}</Field>
        <Field label="SEO description">{product.seo?.description}</Field>
        <Field label="Template suffix">{product.template_suffix}</Field>
        <Field label="Online store">
          <ExternalLink href={product.online_store_url}>Open live page</ExternalLink>
        </Field>
        <Field label="Preview">
          <ExternalLink href={product.online_store_preview_url}>
            Open preview
          </ExternalLink>
        </Field>
      </FieldGrid>
    </DetailSection>
  )
}

// --- Metafields ------------------------------------------------------------------

function getMetafieldRows(product: ProductDetail) {
  return [
    ...product.metafields.map((field) => ({ scope: 'Product', ...field })),
    ...product.variants.flatMap((variant) =>
      variant.metafields.map((field) => ({
        scope: variant.title ?? variant.sku ?? 'Variant',
        ...field,
      })),
    ),
  ]
}

export function MetafieldsPanel({ product }: { product: ProductDetail }) {
  const rows = getMetafieldRows(product)
  if (rows.length === 0) return <Empty icon={ListChecksIcon}>No metafields.</Empty>

  return (
    <TableWrap>
      <thead>
        <tr>
          <th className={TH}>Applies to</th>
          <th className={TH}>Field</th>
          <th className={TH}>Type</th>
          <th className={TH}>Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={index}
            className="border-border even:bg-surface border-b last:border-b-0"
          >
            <td className={TD}>{row.scope}</td>
            <td className={`${TD} font-mono text-[0.8rem]`}>
              {row.namespace}.{row.key}
            </td>
            <td className={TD}>{row.type ?? '—'}</td>
            <td className={`${TD} max-w-96 truncate`} title={row.value ?? ''}>
              {row.value ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  )
}

export { RawPanel }
