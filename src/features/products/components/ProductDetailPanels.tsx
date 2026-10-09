import { useMemo, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
  BoxesIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import type {
  ProductDetail,
  ProductListItem,
  ProductVariant,
} from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice } from '../../../lib/format.ts'
import {
  formatRange,
  htmlToText,
  safeUrl,
  statusLabel,
  statusTone,
} from '../utils/format.ts'
import { CopyButton } from './CopyButton.tsx'
import { DetailSection, Field, FieldGrid } from './DetailSection.tsx'
import { ProductImage } from './ProductImage.tsx'

const TH =
  'text-text-muted border-border bg-accent-tint/60 border-b px-3.5 py-2.5 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'
const TD = 'px-3.5 py-2.5 text-[0.85rem] whitespace-nowrap'
const CARD = 'border-border bg-bg rounded-xl border'

const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? null : value ? 'Yes' : 'No'
const date = (value: string | null | undefined) => (value ? formatDate(value) : null)
const num = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-GB')

function Empty({
  icon: Icon,
  children,
}: {
  icon: typeof BoxesIcon
  children: ReactNode
}) {
  return (
    <div
      className={`${CARD} text-text-muted flex flex-col items-center gap-2 px-4 py-14 text-center text-[0.9rem]`}
    >
      <Icon width={28} height={28} />
      {children}
    </div>
  )
}

function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  )
}

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

export function PanelSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {[0, 1].map((n) => (
        <div key={n} className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="bg-border/70 h-5 w-48 animate-pulse rounded" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="bg-border/70 h-3 w-20 animate-pulse rounded" />
                <div className="bg-border/70 h-4 w-32 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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
  const imageUrl =
    product?.featured_image_url ?? product?.images[0]?.url ?? preview?.image_url ?? null
  const fullImage = safeUrl(imageUrl)

  const currency = product?.currency ?? preview?.currency
  const price = product?.price_range
    ? formatRange(product.price_range.min, product.price_range.max, currency)
    : preview
      ? formatRange(preview.price_min, preview.price_max, preview.currency)
      : '—'
  const compareAt = product?.compare_at_price_range
  const stock = (product ? product.total_inventory : preview?.total_inventory) ?? null
  const description = useMemo(() => htmlToText(product?.description_html), [product])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className={`${CARD} relative p-3`}>
          <ProductImage
            src={imageUrl}
            alt={product?.title ?? preview?.title ?? ''}
            size="xl"
          />
          {fullImage && (
            <a
              href={fullImage}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-bg text-text hover:border-accent absolute right-6 bottom-6 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.78rem] font-semibold shadow-sm transition-colors"
            >
              <ExternalLinkIcon width={14} height={14} />
              View Full
            </a>
          )}
        </div>

        <div className="border-border bg-accent-tint/50 rounded-xl border p-5">
          <p className="text-text-muted text-[0.7rem] font-bold tracking-wide uppercase">
            Price
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{price}</p>
          {compareAt?.min && (
            <p className="text-text-muted mt-1 text-[0.82rem]">
              Compare at{' '}
              <span className="line-through">
                {formatRange(compareAt.min, compareAt.max, currency)}
              </span>
            </p>
          )}
        </div>

        <div className="border-border bg-accent-tint/50 rounded-xl border p-5">
          <p className="text-text-muted text-[0.7rem] font-bold tracking-wide uppercase">
            Total stock
          </p>
          <p
            className={`mt-1 text-3xl font-bold tracking-tight ${
              stock !== null && stock <= 0 ? 'text-danger' : ''
            }`}
          >
            {stock === null
              ? '—'
              : stock <= 0
                ? 'Out of stock'
                : stock.toLocaleString('en-GB')}
          </p>
        </div>
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
              <div className="mt-5">
                <p className="text-text-muted mb-2 text-[0.68rem] font-bold tracking-wide uppercase">
                  Tags
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag) => (
                    <li
                      key={tag}
                      className="bg-accent-tint text-accent rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </DetailSection>

          <DetailSection title="Status & Launch" count={6} icon={ListChecksIcon}>
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

          <DetailSection title="Description" icon={CheckCircleIcon}>
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

export function CollectionsPanel({ product }: { product: ProductDetail }) {
  if (product.collections.length === 0) {
    return <Empty icon={LayersIcon}>This product isn&apos;t in any collection.</Empty>
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {product.collections.map((collection) => (
        <li key={collection.id} className={`${CARD} flex flex-col gap-1.5 p-4`}>
          <span className="font-semibold">{collection.title}</span>
          <span className="text-text-muted font-mono text-[0.78rem] break-all">
            {collection.handle}
          </span>
          {collection.collection_type && (
            <span className="mt-1 self-start">
              <Badge tone="neutral">{statusLabel(collection.collection_type)}</Badge>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function MediaPanel({ product }: { product: ProductDetail }) {
  if (product.images.length === 0) {
    return <Empty icon={ImageIcon}>This product has no images.</Empty>
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {product.images.map((image) => (
        <li key={image.id} className={`${CARD} overflow-hidden`}>
          <ProductImage src={image.url} alt={image.alt_text ?? product.title} size="xl" />
          <p className="text-text-muted truncate px-3 py-2 text-[0.75rem]">
            {image.width && image.height ? `${image.width} × ${image.height}` : 'Image'}
          </p>
        </li>
      ))}
    </ul>
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

// --- Raw Shopify data ------------------------------------------------------------

interface RawPanelProps {
  raw: Record<string, unknown> | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export function RawPanel({ raw, isLoading, error, onRetry }: RawPanelProps) {
  const json = useMemo(() => (raw ? JSON.stringify(raw, null, 2) : ''), [raw])

  if (error) {
    return (
      <Empty icon={ListChecksIcon}>
        <p className="text-text font-semibold">Couldn&apos;t load the raw data</p>
        <p>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="border-border bg-bg text-text hover:border-accent mt-1 cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
        >
          Try again
        </button>
      </Empty>
    )
  }
  if (!raw) {
    return (
      <div
        role="status"
        className={`${CARD} text-text-muted flex items-center justify-center gap-2 px-4 py-14 text-[0.9rem]`}
      >
        {isLoading && <SpinnerIcon width={16} height={16} className="animate-spin" />}
        {isLoading ? 'Loading Shopify data…' : 'No raw data available.'}
      </div>
    )
  }

  return (
    <div className={CARD}>
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <p className="text-text-muted text-[0.78rem]">Original Shopify payload</p>
        <CopyButton value={json} label="Copy raw JSON" />
      </div>
      <pre className="max-h-[65svh] overflow-auto p-4 font-mono text-[0.78rem] leading-relaxed">
        {json}
      </pre>
    </div>
  )
}
