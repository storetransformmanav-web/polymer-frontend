import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
  BoxesIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import { ROW_ACTION_DANGER } from '../../../components/ui/rowActions.ts'
import type {
  ProductDetail,
  ProductImage as ProductImageData,
  ProductListItem,
  ProductMediaInput,
  ProductVariant,
} from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice } from '../../../lib/format.ts'
import { sameFile } from '../../../app/store/productPatch.ts'
import {
  APD_KEY,
  APD_NAMESPACE,
  readDescriptionSections,
  type DescriptionSections,
} from '../utils/descriptionSections.ts'
import { htmlToText, safeUrl, statusLabel } from '../utils/format.ts'
import { toSlides, type LightboxSlide } from '../utils/slides.ts'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_CARD as CARD,
  DETAIL_TD as TD,
  DETAIL_TH as TH,
  DetailEmpty as Empty,
  DetailSkeleton as PanelSkeleton,
  DetailTable as TableWrap,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import { preloadRichTextEditor } from '../../../components/ui/richTextEditorChunk.ts'
import { SafeHtml } from '../../../components/ui/SafeHtml.tsx'
import { ScrollRow } from '../../../components/ui/ScrollRow.tsx'
import { usePendingMedia } from '../hooks/usePendingMedia.ts'
import type { SavedHandler, SectionEdit } from '../hooks/useSectionEdit.ts'
import {
  CategoryField,
  DescriptionField,
  HandleField,
  ProductTypeField,
  TemplateSuffixField,
  TitleField,
  VendorField,
} from './edit/BasicsSection.tsx'
import { CollectionsSection as CollectionsEditor } from './edit/CollectionsSection.tsx'
import { DescriptionSectionsSection as DescriptionSectionsEditor } from './edit/DescriptionSectionsSection.tsx'
import {
  EditableCard,
  EditableTab,
  SectionEditControls,
} from './edit/EditableSection.tsx'
import { MediaSection as MediaEditor } from './edit/MediaSection.tsx'
import { SeoSection as SeoEditor } from './edit/SeoSection.tsx'
import { TAG_CHIP, TagsSection as TagsEditor } from './edit/TagsSection.tsx'
import { VariantsSection as VariantsEditor } from './edit/VariantsSection.tsx'
import {
  formatMetafieldValue,
  metafieldName,
  metafieldTypeLabel,
  rawMetafieldValue,
  type MetafieldDisplay,
} from '../utils/metafields.ts'
import { DescriptionAccordion } from './DescriptionAccordion.tsx'
import { AddMediaDialog } from './AddMediaDialog.tsx'
import { RemoveCollectionDialog } from './RemoveCollectionDialog.tsx'
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
const SECTIONS_ERRORS = ['descriptionSections'] as const
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
  // The description sections the store's description app saves in the `apd` metafield.
  const sections = useMemo(() => readDescriptionSections(product), [product])

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
            view={
              <div className="flex flex-col gap-5">
                <FieldGrid>
                  {getSpecs(product).map(([label, value]) => (
                    <Field key={label} label={label}>
                      {value}
                    </Field>
                  ))}
                </FieldGrid>
                {/* Tags are shown here, but can only be changed while the card is edited. */}
                <TagsBlock>
                  <TagsView tags={product.tags} />
                </TagsBlock>
              </div>
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
                <TagsBlock>
                  <TagsEditor {...section} />
                </TagsBlock>
              </div>
            )}
          />

          {sections ? (
            // The description app's sections (metafield apd) stand on their own: just the accordion.
            <DescriptionSectionsBlock
              product={product}
              sections={sections}
              onSaved={onSaved}
            />
          ) : (
            // A product without sections keeps its own description (description_html).
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
                  // The product's own description (description_html), with its structure.
                  <SafeHtml
                    html={product.description_html ?? ''}
                    className="text-[0.9rem] leading-relaxed"
                  />
                ) : (
                  <p className="text-text-muted text-[0.9rem]">No description.</p>
                )
              }
              editor={(section) => <DescriptionField {...section} />}
            />
          )}
        </div>
      )}
    </div>
  )
}

// --- Description sections ----------------------------------------------------------

/**
 * The description sections (Product Description, Product Information…) shown on their own
 * as an accordion, closed to begin with — there is no "Description" card around them. A
 * slim row above has just the pencil, which turns all the sections into an editor in place
 * (titles, formatted text, order, add / remove). Saving sends the product's `apd`
 * metafield (`metafields` of `PUT /products/{id}`).
 */
function DescriptionSectionsBlock({
  product,
  sections,
  onSaved,
}: {
  product: ProductDetail
  sections: DescriptionSections
  onSaved?: SavedHandler
}) {
  return (
    <EditableTab
      product={product}
      what="description"
      errorPrefixes={SECTIONS_ERRORS}
      onSaved={onSaved}
      header={(edit) => (
        <div className="flex min-h-8 items-center justify-end gap-1.5">
          {edit.editing && (
            <p className="text-text-muted mr-auto text-[0.82rem] font-medium">
              Editing description
            </p>
          )}
          <SectionEditControls
            edit={edit}
            what="description"
            onIntent={preloadRichTextEditor}
          />
        </div>
      )}
      view={<DescriptionAccordion {...sections} />}
      editor={(section) => (
        <div className={`${CARD} p-5`}>
          <DescriptionSectionsEditor {...section} />
        </div>
      )}
    />
  )
}

// --- Tags -----------------------------------------------------------------------

/**
 * "Tags" in the Product Specifications card, under its fields. Viewing, they are just
 * chips; they can only be added or removed while the card is being edited (the
 * `TagsEditor` box sits in the same form) and are saved with the card's ✓ Save.
 */
function TagsBlock({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="product-tags-heading" className="flex flex-col gap-2.5">
      <h3 id="product-tags-heading" className="text-[0.95rem] font-semibold">
        Tags
      </h3>
      {children}
    </section>
  )
}

function TagsView({ tags }: { tags: string[] }) {
  return tags.length > 0 ? (
    <ul className="border-border bg-bg flex flex-wrap gap-1.5 rounded-xl border p-2.5">
      {tags.map((tag) => (
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

  // Everything the store has in stock, across all locations (the sum when it isn't given).
  const total =
    product.total_inventory ??
    product.variants.reduce((sum, variant) => sum + (variant.inventory_quantity ?? 0), 0)

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-[56%]`}>Variant</th>
              <th className={`${TH} w-[24%]`}>Price</th>
              <th className={`${TH} w-[20%]`}>Available</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => {
              const currency = variant.currency ?? product.currency
              const weight = weightLabel(variant)
              const details = [
                variant.barcode ? `Barcode ${variant.barcode}` : '',
                weight !== '—' ? weight : '',
              ].filter(Boolean)
              const stock = variant.inventory_quantity
              return (
                <tr
                  key={variant.id}
                  className="border-border hover:bg-accent-tint/60 border-b align-middle transition-colors last:border-b-0"
                >
                  <td className={`${TD} py-3`}>
                    <div className="flex items-center gap-4">
                      {/* A tall picture tile, as in the store's own admin. */}
                      <div className="border-border h-14 w-14 shrink-0 overflow-hidden border">
                        <ProductImage
                          src={variant.image_url ?? null}
                          alt={variant.title ?? ''}
                          size="thumb"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className="block truncate font-semibold"
                          title={variant.title ?? ''}
                        >
                          {variant.title ?? '—'}
                        </span>
                        {variant.sku && (
                          <span className="text-text-muted flex items-center gap-1.5 font-mono text-[0.8rem]">
                            <span className="truncate" title={variant.sku}>
                              {variant.sku}
                            </span>
                            <CopyButton
                              value={variant.sku}
                              label={`Copy ${variant.sku}`}
                            />
                          </span>
                        )}
                        {details.length > 0 && (
                          <span className="text-text-muted truncate text-[0.75rem]">
                            {details.join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={TD}>
                    <span className="flex flex-col">
                      <span className="font-semibold">
                        {formatPrice(variant.price, currency)}
                      </span>
                      {variant.compare_at_price && (
                        <span className="text-text-muted text-[0.78rem] line-through">
                          {formatPrice(variant.compare_at_price, currency)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          (stock ?? 1) <= 0 ? 'text-danger font-semibold' : 'font-medium'
                        }
                      >
                        {num(stock)}
                      </span>
                      {variant.available_for_sale === false && (
                        <Badge tone="neutral">Unavailable</Badge>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-border-strong bg-surface border-t px-3.5 py-3 text-[0.85rem]">
        Total inventory across all locations: <strong>{num(total)}</strong> available
      </p>
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
function CollectionsView({
  product,
  query,
  onRemove,
}: {
  product: ProductDetail
  query: string
  /** The ✕ on a collection was clicked: ask before taking the product out of it. */
  onRemove: (collection: ProductDetail['collections'][number]) => void
}) {
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
        <ul
          aria-label="Collections"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
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

              {/* Always there: removing asks first (see RemoveCollectionDialog). */}
              <button
                type="button"
                aria-label={`Remove from ${collection.title}`}
                title="Remove from this collection"
                onClick={() => onRemove(collection)}
                className={ROW_ACTION_DANGER}
              >
                <XIcon width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * One row above the tiles: "In 10 collections" + a badge per type on the left;
 * the filter box and "Add collection" on the right. While adding, Save / Discard
 * appear beside it and the summary says what is being edited.
 */
function CollectionsHeader({
  product,
  query,
  onQuery,
  edit,
  addOpen,
  onAdd,
}: {
  product: ProductDetail
  query: string
  onQuery: (value: string) => void
  edit: SectionEdit
  /** Whether the "add a collection" box is open (only meaningful while editing). */
  addOpen: boolean
  onAdd: () => void
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
        {/* No pencil: collections are added with "Add collection" (Save / Discard appear
            then) and taken out with the ✕ on a tile. */}
        {edit.editing && <SectionEditControls edit={edit} what="collections" />}
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
  // Every image belongs to the product; some are also the picture of one or more variants.
  const usedBy = (image: ProductImageData) =>
    product.variants
      .filter((variant) => variant.image_url && sameFile(variant.image_url, image.url))
      .map((variant) => variant.title ?? variant.display_name ?? 'Variant')
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
            <p className="text-text-muted truncate px-3 pt-2 text-[0.75rem]">
              {tile.width && tile.height ? `${tile.width} × ${tile.height}` : 'Image'}
            </p>
            <p
              className="text-text truncate px-3 pb-2 text-[0.75rem] font-medium"
              title={usedBy(tile.image).join(', ')}
            >
              {usedBy(tile.image).length > 0
                ? `Variant: ${usedBy(tile.image).join(', ')}`
                : 'Product image'}
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

interface MetafieldRow {
  /** "Whole product", or the variant it belongs to. */
  appliesTo: string
  namespace: string
  key: string
  type?: string | null | undefined
  value?: string | null | undefined
}

function getMetafieldRows(product: ProductDetail): MetafieldRow[] {
  return [
    ...product.metafields.map((field) => ({ appliesTo: 'Whole product', ...field })),
    ...product.variants.flatMap((variant) =>
      variant.metafields.map((field) => ({
        appliesTo: `Variant: ${variant.title ?? variant.sku ?? 'Variant'}`,
        ...field,
      })),
    ),
  ]
}

/** A metafield's value, laid out by what it is (see `formatMetafieldValue`). */
function MetafieldValue({ display }: { display: MetafieldDisplay }) {
  switch (display.kind) {
    case 'empty':
      return <span className="text-text-muted">Empty</span>
    case 'text':
      return <span className="break-words whitespace-pre-wrap">{display.text}</span>
    case 'list':
      return (
        <ul className="flex flex-wrap gap-1.5">
          {display.items.map((item, index) => (
            <li key={`${item}-${index}`} className={TAG_CHIP}>
              {item}
            </li>
          ))}
        </ul>
      )
    case 'link':
      return <ExternalLink href={display.href}>{display.text}</ExternalLink>
    case 'color':
      return (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            style={{ backgroundColor: display.color }}
            className="border-border h-5 w-5 rounded-md border"
          />
          <span className="font-mono text-[0.8rem]">{display.color}</span>
        </span>
      )
    case 'pairs':
      return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.82rem]">
          {display.pairs.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-text-muted">{label}</dt>
              <dd className="m-0 break-words">{value}</dd>
            </Fragment>
          ))}
        </dl>
      )
  }
}

/**
 * Metafields, in plain words: what the detail is called, what kind of detail it is, what
 * it holds, and whether it belongs to the whole product or to one variant. The technical
 * name (`namespace.key`) stays underneath for anyone who needs it, and the original value
 * can be opened for structured data.
 */
export function MetafieldsPanel({ product }: { product: ProductDetail }) {
  const rows = getMetafieldRows(product)
  const sections = readDescriptionSections(product)
  if (rows.length === 0) return <Empty icon={ListChecksIcon}>No metafields.</Empty>

  return (
    <div className="flex flex-col gap-4">
      <TableWrap>
        <thead>
          <tr>
            <th className={TH}>Detail</th>
            <th className={TH}>Applies to</th>
            <th className={TH}>Kind</th>
            <th className={TH}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isSections = row.namespace === APD_NAMESPACE && row.key === APD_KEY
            const display = formatMetafieldValue(row.type, row.value)
            const raw = rawMetafieldValue(row.type, row.value)
            return (
              <tr
                key={`${row.namespace}.${row.key}-${index}`}
                className="border-border even:bg-surface border-b align-top last:border-b-0"
              >
                <td className={`${TD} whitespace-normal`}>
                  <p className="font-semibold">{metafieldName(row.namespace, row.key)}</p>
                </td>
                <td className={`${TD} whitespace-normal`}>{row.appliesTo}</td>
                <td className={`${TD} whitespace-normal`}>
                  {metafieldTypeLabel(row.type)}
                </td>
                <td className={`${TD} max-w-md min-w-56 whitespace-normal`}>
                  {isSections && sections ? (
                    <div className="flex flex-col gap-1.5">
                      <p>
                        {sections.sections.length}{' '}
                        {sections.sections.length === 1 ? 'section' : 'sections'}:{' '}
                        {sections.sections.map((section) => section.title).join(', ')}
                      </p>
                      <p className="text-text-muted text-[0.78rem] leading-snug">
                        Shown in the Description card on the Overview tab. The rest of
                        this detail is the description app&apos;s look (colours, fonts,
                        spacing).
                      </p>
                    </div>
                  ) : (
                    <MetafieldValue display={display} />
                  )}
                  {raw && (
                    <details className="mt-1.5">
                      <summary className="text-accent cursor-pointer text-[0.76rem] font-semibold">
                        View original value
                      </summary>
                      <pre className="border-border bg-surface mt-1.5 max-h-56 overflow-auto rounded-lg border p-2.5 font-mono text-[0.72rem] leading-relaxed break-words whitespace-pre-wrap">
                        {raw}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </div>
  )
}

// --- Editable tabs ----------------------------------------------------------------
// Each tab shows its read-only view; the pencil above it turns the tab into an
// editor in place (see EditableTab). Saving sends only what changed in that tab.

interface TabProps {
  product: ProductDetail
  onSaved?: SavedHandler
}

/** "2 variants", each option as a label with a pill per value, and the pencil (or Save / Discard). */
function VariantsHeader({
  product,
  edit,
}: {
  product: ProductDetail
  edit: SectionEdit
}) {
  const options = product.has_only_default_variant ? [] : product.options
  const count = product.variants.length
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-5 gap-y-2">
      {edit.editing ? (
        <p className="text-text-muted text-[0.82rem] font-medium">Editing variants</p>
      ) : (
        <>
          <p className="text-[0.95rem] font-semibold">
            {count} {count === 1 ? 'variant' : 'variants'}
          </p>
          {options.map((option) => (
            <div key={option.name} className="flex flex-wrap items-center gap-1.5">
              <span className="text-text-muted text-[0.7rem] font-bold tracking-wide uppercase">
                {option.name}
              </span>
              <ul className="flex flex-wrap gap-1.5">
                {option.values.map((value) => (
                  <li
                    key={value}
                    className="border-border-strong bg-bg rounded-full border px-2.5 py-0.5 text-[0.78rem] font-medium"
                  >
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <SectionEditControls edit={edit} what="variants" />
      </div>
    </div>
  )
}

export function VariantsPanel({ product, onSaved }: TabProps) {
  return (
    <EditableTab
      product={product}
      what="variants"
      errorPrefixes={VARIANT_ERRORS}
      onSaved={onSaved}
      header={(edit) => <VariantsHeader product={product} edit={edit} />}
      view={<VariantsView product={product} />}
      editor={(section) => <VariantsEditor {...section} />}
    />
  )
}

export function CollectionsPanel({ product, onSaved }: TabProps) {
  const [query, setQuery] = useState('')
  // The "add a collection" box stays hidden until "Add collection" is clicked, then
  // sits on top of the list.
  const [addOpen, setAddOpen] = useState(false)
  // The collection whose ✕ was clicked, waiting for "Remove".
  const [removing, setRemoving] = useState<ProductDetail['collections'][number] | null>(
    null,
  )

  return (
    <>
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
        view={<CollectionsView product={product} query={query} onRemove={setRemoving} />}
        editor={(section) => (
          <CollectionsEditor {...section} showAdd={addOpen} focusAdd />
        )}
      />

      {removing && (
        <RemoveCollectionDialog
          key={removing.id}
          product={product}
          collection={removing}
          onClose={() => setRemoving(null)}
          onDone={(result) => {
            setRemoving(null)
            onSaved?.(result, product, { collections_remove: [removing.id] })
          }}
        />
      )}
    </>
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
