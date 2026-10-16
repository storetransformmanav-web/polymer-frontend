import { useMemo, useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
  BoxesIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  PlusCircleIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from '../../../components/ui/icons.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import type {
  ProductDetail,
  ProductImage as ProductImageData,
  ProductListItem,
  ProductMediaInput,
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
  DetailSkeleton as PanelSkeleton,
  RawJsonPanel as RawPanel,
  DetailTable as TableWrap,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import { preloadRichTextEditor } from '../../../components/ui/richTextEditorChunk.ts'
import { ScrollRow } from '../../../components/ui/ScrollRow.tsx'
import { usePendingMedia } from '../hooks/usePendingMedia.ts'
import type { SavedHandler, SectionEdit } from '../hooks/useSectionEdit.ts'
import {
  CategoryField,
  DescriptionField,
  HandleField,
  ProductTypeField,
  StatusField,
  TemplateSuffixField,
  TitleField,
  VendorField,
} from './edit/BasicsSection.tsx'
import { CollectionsSection as CollectionsEditor } from './edit/CollectionsSection.tsx'
import {
  EditableCard,
  EditableTab,
  SectionEditControls,
} from './edit/EditableSection.tsx'
import { MediaSection as MediaEditor } from './edit/MediaSection.tsx'
import { SeoSection as SeoEditor } from './edit/SeoSection.tsx'
import { TAG_CHIP, TagsSection as TagsEditor } from './edit/TagsSection.tsx'
import { VariantsSection as VariantsEditor } from './edit/VariantsSection.tsx'
import { AddMediaDialog } from './AddMediaDialog.tsx'
import { DeleteMediaDialog } from './DeleteMediaDialog.tsx'
import { ProductImage } from './ProductImage.tsx'
import { ProductLightbox } from './ProductLightbox.tsx'

// Which validation problems belong to each editable section (see useSectionEdit).
const SPEC_ERRORS = [
  'title',
  'vendor',
  'productType',
  'handle',
  'templateSuffix',
  'categoryGid',
] as const
const NO_ERRORS = [] as const
const SEO_ERRORS = ['seoTitle', 'seoDescription'] as const
const VARIANT_ERRORS = ['variants'] as const
const COLLECTION_ERRORS = ['addedCollections'] as const
const MEDIA_ERRORS = ['images'] as const

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
  /** Called after a section of the product is saved here. */
  onSaved?: SavedHandler
}

export function OverviewPanel({ product, preview, onSaved }: OverviewProps) {
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
          <div className={`${CARD} p-3`}>
            {/* One row of thumbnails that scrolls sideways — however many images there are. */}
            <ScrollRow label="Product media">
              {gallery.map((slide, index) => (
                <li
                  key={`${slide.src}-${index}`}
                  className="w-[4.5rem] shrink-0 snap-start"
                >
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
            </ScrollRow>
          </div>
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
          <EditableCard
            product={product}
            title="Product Specifications"
            count={getSpecs(product).length}
            icon={LayersIcon}
            what="specifications"
            errorPrefixes={SPEC_ERRORS}
            onSaved={onSaved}
            // Tags belong to this card, under the fields, with an edit session of their own.
            after={<TagsBlock product={product} onSaved={onSaved} />}
            view={
              <FieldGrid>
                {getSpecs(product).map(([label, value]) => (
                  <Field key={label} label={label}>
                    {value}
                  </Field>
                ))}
              </FieldGrid>
            }
            editor={(section) => (
              <div className="flex flex-col gap-5">
                <TitleField {...section} />
                <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
                  <VendorField {...section} />
                  <ProductTypeField {...section} />
                  <TemplateSuffixField {...section} />
                  <HandleField {...section} />
                </div>
                <CategoryField {...section} />
              </div>
            )}
          />

          <EditableCard
            product={product}
            title="Status & Launch"
            count={6}
            icon={ListChecksIcon}
            defaultOpen={false}
            what="status"
            errorPrefixes={NO_ERRORS}
            onSaved={onSaved}
            view={
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
            }
            editor={(section) => (
              <div className="max-w-xs">
                <StatusField {...section} />
              </div>
            )}
          />

          <EditableCard
            product={product}
            title="Description"
            icon={CheckCircleIcon}
            defaultOpen={false}
            what="description"
            onEditIntent={preloadRichTextEditor}
            errorPrefixes={NO_ERRORS}
            onSaved={onSaved}
            view={
              description ? (
                <p className="text-[0.9rem] leading-relaxed whitespace-pre-line">
                  {description}
                </p>
              ) : (
                <p className="text-text-muted text-[0.9rem]">No description.</p>
              )
            }
            editor={(section) => <DescriptionField {...section} />}
          />
        </div>
      )}
    </div>
  )
}

// --- Tags -----------------------------------------------------------------------

/**
 * "Tags" in the Product Specifications card: one bordered card with every tag as a chip. The ⊕ beside the heading opens the
 * card for editing — a box to type new tags into sits right in the card, each
 * chip gets a ✕ — and the heading's buttons become ✓ Save / ✕ Discard.
 */
function TagsBlock({
  product,
  onSaved,
}: {
  product: ProductDetail
  onSaved?: SavedHandler
}) {
  return (
    <section aria-labelledby="product-tags-heading">
      <EditableTab
        product={product}
        what="tags"
        errorPrefixes={NO_ERRORS}
        onSaved={onSaved}
        header={(edit) => (
          <div className="flex items-center justify-between gap-3">
            <h3 id="product-tags-heading" className="text-[0.95rem] font-semibold">
              Tags
            </h3>
            {edit.editing ? (
              <div className="flex items-center gap-1.5">
                <SectionEditControls edit={edit} what="tags" />
              </div>
            ) : (
              <button
                type="button"
                onClick={edit.start}
                aria-label="Add tags"
                title="Add tags"
                className="text-text-muted hover:text-accent focus-visible:outline-accent inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors focus-visible:outline-2"
              >
                <PlusCircleIcon width={22} height={22} />
              </button>
            )}
          </div>
        )}
        view={
          product.tags.length > 0 ? (
            <ul className="border-border bg-bg flex flex-wrap gap-1.5 rounded-xl border p-2.5">
              {product.tags.map((tag) => (
                <li key={tag} className={TAG_CHIP}>
                  {tag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-border bg-bg text-text-muted rounded-xl border p-2.5 text-[0.85rem]">
              No tags yet.
            </p>
          )
        }
        editor={(section) => <TagsEditor {...section} />}
      />
    </section>
  )
}

// --- Variants ----------------------------------------------------------------

function weightLabel(variant: ProductVariant): string {
  const weight = Number.parseFloat(variant.weight ?? '')
  if (!Number.isFinite(weight) || weight === 0) return '—'
  return `${weight} ${(variant.weight_unit ?? '').toLowerCase()}`.trim()
}

function VariantsView({ product }: { product: ProductDetail }) {
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

/** The collections as tiles, narrowed by the header's filter box. */
function CollectionsView({ product, query }: { product: ProductDetail; query: string }) {
  const { collections } = product

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
    <>
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
    </>
  )
}

/**
 * One row above the tiles: "In 10 collections" + a badge per type on the left;
 * the filter box, the pencil and "Add collection" on the right. While editing,
 * the pencil becomes Save / Discard and the summary says what is being edited.
 */
function CollectionsHeader({
  product,
  query,
  onQuery,
  edit,
  addOpen,
  onAdd,
  onStart,
}: {
  product: ProductDetail
  query: string
  onQuery: (value: string) => void
  edit: SectionEdit
  /** Whether the "add by ID" box is open (only meaningful while editing). */
  addOpen: boolean
  onAdd: () => void
  onStart: () => void
}) {
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

  const summary = edit.editing
    ? 'Editing collections'
    : collections.length === 0
      ? 'Not in any collection'
      : `In ${collections.length} ${collections.length === 1 ? 'collection' : 'collections'}`

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="mr-auto flex min-w-0 flex-wrap items-center gap-2">
        <p className="text-[0.95rem] font-semibold">{summary}</p>
        {!edit.editing &&
          counts.map(([label, count]) => (
            <Badge key={label} tone={label === 'Smart' ? 'default' : 'neutral'}>
              {count} {label}
            </Badge>
          ))}
      </div>

      {!edit.editing && collections.length >= COLLECTION_FILTER_MIN && (
        <div className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex h-9 w-full items-center gap-2 rounded-lg border px-3 focus-within:outline-2 sm:w-64">
          <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Filter collections"
            placeholder="Filter collections…"
            maxLength={100}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <SectionEditControls edit={edit} what="collections" onStart={onStart} />
        <button
          type="button"
          onClick={onAdd}
          aria-expanded={edit.editing ? addOpen : undefined}
          className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors ${
            edit.editing && addOpen
              ? 'border-accent text-accent bg-accent-tint'
              : 'border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint'
          }`}
        >
          <PlusIcon width={14} height={14} />
          Add collection
        </button>
      </div>
    </div>
  )
}

interface MediaTile {
  image: ProductImageData
  src: string
  alt: string
  width?: number
  height?: number
}

/**
 * The product's images as tiles (click one to open the lightbox). Each has a
 * Delete button, and files that were just added show as "processing" tiles until
 * the store has finished downloading them.
 */
function MediaView({
  product,
  pending,
  slow,
  onDismiss,
  onDelete,
}: {
  product: ProductDetail
  pending: ProductMediaInput[]
  /** The store is taking longer than usual to finish the waiting files. */
  slow: boolean
  onDismiss: () => void
  onDelete: (image: ProductImageData, position: number) => void
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  // Only images with a safe (http/https) URL are shown; each keeps its own record for Delete.
  const tiles = useMemo<MediaTile[]>(
    () =>
      product.images.flatMap((image) => {
        const src = safeUrl(image.url)
        return src
          ? [
              {
                image,
                src,
                alt: image.alt_text ?? product.title,
                width: image.width ?? undefined,
                height: image.height ?? undefined,
              },
            ]
          : []
      }),
    [product.images, product.title],
  )
  const slides = useMemo(
    () => toSlides(product.images, product.title),
    [product.images, product.title],
  )

  if (tiles.length === 0 && pending.length === 0) {
    return <Empty icon={ImageIcon}>This product has no images.</Empty>
  }

  return (
    <>
      {pending.length > 0 && slow && (
        <div
          role="status"
          className="bg-warning-bg text-text mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-[0.85rem]"
        >
          <p className="min-w-0 flex-1">
            The store is taking longer than usual to finish{' '}
            {pending.length === 1 ? 'this file' : 'these files'}. It only accepts a
            direct, public link to an image file (a web page link won&apos;t work). The
            image will appear here once the store has it, and Sync products brings it in
            too.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="text-accent cursor-pointer border-none bg-transparent p-0 text-[0.85rem] font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {tiles.map((tile, index) => (
          <li key={tile.image.id} className={`${CARD} relative overflow-hidden`}>
            <button
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`Open image ${index + 1} of ${tiles.length}`}
              className="focus-visible:outline-accent block w-full cursor-zoom-in border-none bg-transparent p-0 focus-visible:outline-2"
            >
              <ProductImage src={tile.src} alt={tile.alt} size="xl" />
            </button>
            <div className="absolute top-2 right-2">
              <IconAction
                label="Delete"
                accessibleLabel={`Delete image ${index + 1}`}
                icon={TrashIcon}
                tone="danger"
                onClick={() => onDelete(tile.image, index + 1)}
              />
            </div>
            <p className="text-text-muted truncate px-3 py-2 text-[0.75rem]">
              {tile.width && tile.height ? `${tile.width} × ${tile.height}` : 'Image'}
            </p>
          </li>
        ))}

        {pending.map((item, index) => (
          <li
            key={`pending-${item.url}-${index}`}
            aria-label="Processing"
            className={`${CARD} border-accent/40 relative overflow-hidden`}
          >
            <div className="relative">
              <ProductImage src={item.url} alt={item.alt ?? ''} size="xl" />
              <div className="bg-bg/70 absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
                <SpinnerIcon
                  width={22}
                  height={22}
                  className="text-accent animate-spin"
                />
                <span className="text-text text-[0.78rem] font-semibold">
                  Processing…
                </span>
              </div>
            </div>
            <p className="text-text-muted truncate px-3 py-2 text-[0.75rem]">
              {slow ? 'Still waiting for the store' : 'Waiting for the store'}
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

/**
 * One row above the tiles, like the Collections tab: how many images there are,
 * the pencil (alt text and order) and "Add media". While editing, the pencil
 * becomes Save / Discard.
 */
function MediaHeader({
  count,
  waiting,
  edit,
  onAdd,
}: {
  count: number
  /** Files sent to the store that are not in the product yet. */
  waiting: number
  edit: SectionEdit
  onAdd: () => void
}) {
  const waitingText = waiting > 0 ? `${waiting} processing` : ''
  const summary = edit.editing
    ? 'Editing media'
    : count === 0
      ? waitingText || 'No images'
      : `${count} ${count === 1 ? 'image' : 'images'}${waitingText ? ` · ${waitingText}` : ''}`

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="mr-auto text-[0.95rem] font-semibold">{summary}</p>
      <div className="flex items-center gap-1.5">
        <SectionEditControls edit={edit} what="media" />
        {!edit.editing && (
          <button
            type="button"
            onClick={onAdd}
            className="border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors"
          >
            <PlusIcon width={14} height={14} />
            Add media
          </button>
        )}
      </div>
    </div>
  )
}

// --- SEO & online store ---------------------------------------------------------

export function SeoPanel({
  product,
  onSaved,
}: {
  product: ProductDetail
  onSaved?: SavedHandler
}) {
  return (
    <EditableCard
      product={product}
      title="SEO & Online Store"
      count={5}
      icon={ExternalLinkIcon}
      what="search listing"
      errorPrefixes={SEO_ERRORS}
      onSaved={onSaved}
      view={
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
      }
      editor={(section) => <SeoEditor {...section} />}
    />
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

// --- Editable tabs ----------------------------------------------------------------
// Each tab shows its read-only view; the pencil above it turns the tab into an
// editor in place (see EditableTab). Saving sends only what changed in that tab.

interface TabProps {
  product: ProductDetail
  onSaved?: SavedHandler
}

export function VariantsPanel({ product, onSaved }: TabProps) {
  return (
    <EditableTab
      product={product}
      what="variants"
      errorPrefixes={VARIANT_ERRORS}
      onSaved={onSaved}
      view={<VariantsView product={product} />}
      editor={(section) => <VariantsEditor {...section} />}
    />
  )
}

export function CollectionsPanel({ product, onSaved }: TabProps) {
  const [query, setQuery] = useState('')
  // The "add by ID" box stays hidden until "Add collection" is clicked, then
  // sits on top of the list. The pencil opens the editor without it.
  const [addOpen, setAddOpen] = useState(false)

  return (
    <EditableTab
      product={product}
      what="collections"
      errorPrefixes={COLLECTION_ERRORS}
      onSaved={onSaved}
      header={(edit) => (
        <CollectionsHeader
          product={product}
          query={query}
          onQuery={setQuery}
          edit={edit}
          addOpen={addOpen}
          onStart={() => setAddOpen(false)}
          onAdd={() => {
            if (edit.editing) {
              setAddOpen((open) => !open)
            } else {
              setAddOpen(true)
              edit.start()
            }
          }}
        />
      )}
      view={<CollectionsView product={product} query={query} />}
      editor={(section) => <CollectionsEditor {...section} showAdd={addOpen} focusAdd />}
    />
  )
}

export function MediaPanel({ product, onSaved }: TabProps) {
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<{
    image: ProductImageData
    position: number
  } | null>(null)
  const media = usePendingMedia(product)

  return (
    <>
      <EditableTab
        product={product}
        what="media"
        errorPrefixes={MEDIA_ERRORS}
        onSaved={onSaved}
        header={(edit) => (
          <MediaHeader
            count={product.images.length}
            waiting={media.pending.length}
            edit={edit}
            onAdd={() => setAdding(true)}
          />
        )}
        view={
          <MediaView
            product={product}
            pending={media.pending}
            slow={media.slow}
            onDismiss={media.dismiss}
            onDelete={(image, position) => setDeleting({ image, position })}
          />
        }
        editor={(section) => <MediaEditor {...section} />}
      />

      {adding && (
        <AddMediaDialog
          product={product}
          onClose={() => setAdding(false)}
          onDone={(result, items) => {
            setAdding(false)
            media.queue(items)
            onSaved?.(result, product, {})
          }}
        />
      )}

      {deleting && (
        <DeleteMediaDialog
          product={product}
          image={deleting.image}
          position={deleting.position}
          onClose={() => setDeleting(null)}
          onDone={(result) => {
            setDeleting(null)
            onSaved?.(result, product, {})
          }}
        />
      )}
    </>
  )
}
