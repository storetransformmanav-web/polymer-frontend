import { useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_CARD as CARD,
  DetailEmpty as Empty,
  Field,
} from '../../../components/ui/DetailSection.tsx'
import {
  BoxesIcon,
  ExternalLinkIcon,
  ImageIcon,
  PencilIcon,
} from '../../../components/ui/icons.tsx'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { formatPrice } from '../../../lib/format.ts'
import type { ProductDetail, ProductVariant } from '../../../lib/api/endpoints.ts'
import type { SavedHandler } from '../hooks/useSectionEdit.ts'
import { countryName } from '../utils/countries.ts'
import { variantImageId } from '../utils/editDraft.ts'
import { toSlides, type LightboxSlide } from '../utils/slides.ts'
import { productStock, variantStock } from '../utils/stock.ts'
import { VariantBulkEdit } from './edit/VariantBulkEdit.tsx'
import { VariantEditDialog } from './edit/VariantEditDialog.tsx'
import { StockCell, VariantFieldCell } from './InlineEdits.tsx'
import { ProductImage } from './ProductImage.tsx'
import { ProductLightbox } from './ProductLightbox.tsx'
import { VariantImageDialog } from './VariantImageDialog.tsx'

const num = (value: number) => value.toLocaleString('en-GB')
const IMAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.78rem] font-semibold shadow-sm transition-colors'

/** "250 g"-style weight, or nothing for none / zero. */
function weightOf(variant: ProductVariant): string {
  const weight = Number(variant.weight)
  if (!variant.weight || !Number.isFinite(weight) || weight <= 0) return ''
  const unit = (variant.weight_unit ?? '').toLowerCase()
  return `${variant.weight} ${unit === 'grams' ? 'g' : unit === 'kilograms' ? 'kg' : unit}`.trim()
}

/** "22 × 13.7 × 4.2 cm", or nothing when no size is set. */
function sizeOf(variant: ProductVariant): string {
  const box = variant.packed_dimensions
  if (!box) return ''
  const parts = [box.length, box.width, box.height].map(Number)
  if (parts.some((part) => !Number.isFinite(part) || part <= 0)) return ''
  const unit = (box.unit ?? '').toLowerCase() === 'inches' ? 'in' : 'cm'
  return `${parts.join(' × ')} ${unit}`
}

function yesNo(value: boolean | null | undefined): ReactNode {
  if (value === null || value === undefined) return ''
  return value ? 'Yes' : 'No'
}

/**
 * **The variants**, as one clean view instead of a table: the picture of the chosen variant on
 * the left with a **Unit price** card under it, and on the right a row of pills to choose the
 * variant and a **Details** card of labelled fields. Choosing another variant changes the
 * picture, the price and every field at once. **Change image** picks one of the product's pictures
 * for the variant; **View Full** opens it in the lightbox. Every value in the details is changed
 * by double-clicking it (a small pencil marks it): each asks "Are you sure?" and sends just that
 * field. **Bulk edit** turns all the variants into the spreadsheet like the products' bulk editor.
 */
export function VariantCombinations({
  product,
  onSaved,
  onNewVariant,
}: {
  product: ProductDetail
  onSaved?: SavedHandler
  /** Opens the New variant window. */
  onNewVariant?: () => void
}) {
  const [selectedId, setSelectedId] = useState(product.variants[0]?.id ?? '')
  const [bulk, setBulk] = useState<string[] | null>(null)
  const [changing, setChanging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)

  if (product.variants.length === 0) {
    return <Empty icon={BoxesIcon}>This product has no variants.</Empty>
  }
  if (bulk) {
    return (
      <VariantBulkEdit
        product={product}
        ids={bulk}
        onSaved={onSaved}
        onClose={() => setBulk(null)}
      />
    )
  }

  const variant =
    product.variants.find((candidate) => candidate.id === selectedId) ??
    product.variants[0]
  const title = variant.title ?? 'Variant'
  const currency = variant.currency ?? product.currency
  const stock = variantStock(variant)
  const out = (stock ?? 0) <= 0
  const onlyLevel =
    variant.inventory_levels.length === 1 ? variant.inventory_levels[0] : null
  const total = productStock(product) ?? 0
  const src = safeUrl(variant.image_url)

  // The lightbox: the product's pictures, opened on the variant's own; a picture that is not
  // among them (still arriving) is shown alone.
  const slides: LightboxSlide[] = toSlides(product.images, product.title)
  const pictureId = variantImageId(variant, product.images)
  const at = slides.findIndex((slide) => slide.id === pictureId)
  const viewSlides: LightboxSlide[] =
    at >= 0 || !src ? slides : [{ src, alt: `Picture of ${title}` }]

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <figure
          aria-label={`Picture of ${title}`}
          className={`${CARD} relative m-0 overflow-hidden p-3`}
        >
          <ProductImage
            src={variant.image_url ?? null}
            alt={`Picture of ${title}`}
            size="xl"
          />
          <div className="absolute right-5 bottom-5 left-5 flex flex-wrap justify-end gap-1.5">
            {src && (
              <button
                type="button"
                onClick={() => setLightbox(at >= 0 ? at : 0)}
                className={IMAGE_BUTTON}
              >
                <ExternalLinkIcon width={14} height={14} />
                View Full
              </button>
            )}
            <button
              type="button"
              onClick={() => setChanging(true)}
              className={IMAGE_BUTTON}
            >
              <ImageIcon width={14} height={14} />
              Change image
            </button>
          </div>
        </figure>

        <section
          aria-label="Unit price"
          className="border-border-strong bg-accent-tint/30 flex flex-col gap-1 rounded-xl border px-4 py-3"
        >
          <p className="text-text-muted text-[0.68rem] font-bold tracking-wide uppercase">
            Unit price
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2.5 text-[1.7rem] leading-tight font-bold">
            {formatPrice(variant.price, currency)}
            {variant.compare_at_price &&
              Number(variant.compare_at_price) > Number(variant.price) && (
                <span className="text-text-muted text-[0.95rem] font-medium line-through">
                  {formatPrice(variant.compare_at_price, currency)}
                </span>
              )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {out ? (
              <Badge tone="danger">Out of stock</Badge>
            ) : (
              <Badge tone="success">{`${num(stock ?? 0)} in stock`}</Badge>
            )}
            {variant.available_for_sale === false && (
              <Badge tone="neutral">Unavailable</Badge>
            )}
          </p>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <section
          aria-label="Choose a variant"
          className={`${CARD} flex flex-col gap-3 p-4`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold">
              Variants
              <span className="bg-accent-tint text-text-muted rounded-full px-2 text-[0.72rem]">
                {product.variants.length}
              </span>
            </h3>
            <span className="text-text-muted text-[0.8rem]">
              Total inventory across all locations: <strong>{num(total)}</strong>{' '}
              available
            </span>
            <button
              type="button"
              onClick={() => setBulk(product.variants.map((candidate) => candidate.id))}
              className="border-border bg-bg text-text hover:border-accent ml-auto inline-flex h-8 cursor-pointer items-center rounded-lg border px-3 text-[0.8rem] font-semibold transition-colors"
            >
              Bulk edit
            </button>
          </div>
          <ul aria-label="Variants" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {product.variants.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  aria-pressed={candidate.id === variant.id}
                  onClick={() => setSelectedId(candidate.id)}
                  className={`cursor-pointer rounded-full border px-3.5 py-1 text-[0.82rem] font-medium transition-colors ${
                    candidate.id === variant.id
                      ? 'border-accent bg-accent-tint text-text'
                      : 'border-border-strong bg-bg text-text hover:bg-accent-tint/60'
                  }`}
                >
                  {candidate.title ?? 'Variant'}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={`Details of ${title}`} className={CARD}>
          <div className="border-border-strong flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <h3 className="text-[0.95rem] font-semibold">{title}</h3>
            <div className="flex items-center gap-3">
              <p className="text-text-muted hidden items-center gap-1.5 text-[0.76rem] sm:flex">
                <PencilIcon width={12} height={12} />
                Double-click a value to change it
              </p>
              <button
                type="button"
                aria-label={`Edit variant ${title}`}
                onClick={() => setEditing(true)}
                className="border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.8rem] font-semibold transition-colors"
              >
                <PencilIcon width={13} height={13} />
                Edit variant
              </button>
            </div>
          </div>
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-5 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Options">
              {variant.selected_options && variant.selected_options.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {variant.selected_options.map((chosen) => (
                    <span
                      key={chosen.name}
                      className="border-border-strong bg-surface rounded-full border px-2.5 py-0.5 text-[0.8rem]"
                    >
                      <span className="text-text-muted">{chosen.name}: </span>
                      {chosen.value}
                    </span>
                  ))}
                </span>
              ) : null}
            </Field>
            <Field label="SKU">
              <span className="flex items-center gap-1">
                <VariantFieldCell
                  product={product}
                  variant={variant}
                  field="sku"
                  onSaved={onSaved}
                  icon
                />
                {variant.sku && (
                  <CopyButton value={variant.sku} label={`Copy ${variant.sku}`} />
                )}
              </span>
            </Field>
            <Field label="Barcode">
              <VariantFieldCell
                product={product}
                variant={variant}
                field="barcode"
                onSaved={onSaved}
                icon
              />
            </Field>
            <Field label="Price">
              <VariantFieldCell
                product={product}
                variant={variant}
                field="price"
                onSaved={onSaved}
                icon
              />
            </Field>
            <Field label="Compare-at price">
              <VariantFieldCell
                product={product}
                variant={variant}
                field="compare_at_price"
                strike
                onSaved={onSaved}
                icon
              />
            </Field>
            <Field label="Cost per item">
              <VariantFieldCell
                product={product}
                variant={variant}
                field="cost"
                onSaved={onSaved}
                icon
              />
            </Field>
            <Field label="Available">
              {onlyLevel ? (
                <StockCell
                  product={product}
                  variant={variant}
                  level={onlyLevel}
                  onSaved={onSaved}
                />
              ) : (
                <span
                  title={
                    variant.inventory_levels.length > 1
                      ? 'Several locations: change them on the Inventory tab'
                      : undefined
                  }
                  className={out ? 'text-danger' : ''}
                >
                  {stock === null ? '' : num(stock)}
                </span>
              )}
            </Field>
            <Field label="Weight">{weightOf(variant)}</Field>
            <Field label="Packed size">{sizeOf(variant)}</Field>
            <Field label="Country of origin">
              {variant.country_code_of_origin
                ? countryName(variant.country_code_of_origin)
                : ''}
            </Field>
            <Field label="HS code">{variant.harmonized_system_code}</Field>
            <Field label="When out of stock">
              {variant.inventory_policy?.toUpperCase() === 'CONTINUE'
                ? 'Keeps selling'
                : 'Stops selling'}
            </Field>
            <Field label="Physical product">{yesNo(variant.requires_shipping)}</Field>
            <Field label="Charge tax">{yesNo(variant.taxable)}</Field>
          </dl>
        </section>
      </div>

      {editing && (
        <VariantEditDialog
          key={`edit-${variant.id}`}
          product={product}
          variantId={variant.id}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
          onNewVariant={onNewVariant}
        />
      )}
      {changing && (
        <VariantImageDialog
          key={variant.id}
          product={product}
          variant={variant}
          onSaved={onSaved}
          onClose={() => setChanging(false)}
        />
      )}
      <ProductLightbox
        slides={viewSlides}
        index={lightbox}
        onClose={() => setLightbox(null)}
      />
    </div>
  )
}
