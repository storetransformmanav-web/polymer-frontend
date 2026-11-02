import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { DetailSection } from '../../../../components/ui/DetailSection.tsx'
import {
  BoxesIcon,
  ChevronDownIcon,
  LayersIcon,
  SlidersIcon,
  TrashIcon,
} from '../../../../components/ui/icons.tsx'
import { formatPrice } from '../../../../lib/format.ts'
import {
  optionCount,
  variantPreviewUrl,
  type VariantDraft,
} from '../../utils/editDraft.ts'
import { ProductImage } from '../ProductImage.tsx'
import { NewVariantsEditor } from './NewVariantsEditor.tsx'
import { VariantOptionsEditor } from './VariantOptionsEditor.tsx'
import {
  VariantImageCard,
  VariantPriceCard,
  VariantShippingCard,
} from './VariantSections.tsx'
import { ICON_BUTTON, TEXT_BUTTON, type SectionProps } from './fields.tsx'

/** The Image dropdown's choice for "take the picture off this variant". */
const NO_IMAGE = 'none'

/**
 * The Variants editor. On top, the product's **options** in a card called Variants (rename an option
 * or its values, **Add variant** to add an option); then every variant of the product as a collapsible card — price, SKU, stock policy,
 * the **stock at each location**, its picture (another one, or none) and so on, which can be
 * edited or removed (deleted in the store on save); and, once a value has been added, the new variants.
 */
export function VariantsSection(props: SectionProps) {
  const { draft } = props
  const coming = [
    ...draft.addedOptions
      .filter((option) => option.name.trim())
      .map((option) => `${option.name.trim()} (new option)`),
    ...draft.newVariants.map(
      (created, index) =>
        created.optionValues
          .map((value) => value.trim())
          .filter(Boolean)
          .join(' / ') || `New variant ${index + 1}`,
    ),
  ]
  // A problem inside a closed card opens it, so it is never hidden.
  const problemIn = (...prefixes: string[]) =>
    Object.keys(props.errors).some((key) => prefixes.some((p) => key.startsWith(p)))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col">
        <h3 className="text-[1.05rem] font-semibold">Variants</h3>
        <p className="text-text-muted text-[0.8rem]">
          Options and their values, and the variants they make. Nothing is sent until you
          save.
        </p>
      </div>

      {coming.length > 0 && (
        <div className="border-accent/50 bg-accent-tint/30 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-[0.8rem] font-semibold">
            Will be added when you save:
          </span>
          {coming.map((label, index) => (
            <Badge key={`${label}-${index}`} tone="success">
              + {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Three separate cards, all closed to begin with. */}
      <DetailSection
        title="Variants"
        icon={SlidersIcon}
        count={optionCount(draft)}
        actions={<Summary>{optionNames(draft)}</Summary>}
        defaultOpen={false}
        forceOpen={problemIn('options', 'addedOptions')}
        flush
      >
        <VariantOptionsEditor {...props} />
      </DetailSection>

      <DetailSection
        title="Current variants"
        icon={LayersIcon}
        count={draft.variants.length}
        actions={<Summary>{variantSummary(draft, props.product.currency)}</Summary>}
        defaultOpen={false}
        forceOpen={problemIn('variants')}
      >
        <ExistingVariants {...props} />
      </DetailSection>

      {draft.newVariants.length > 0 && (
        // Opens whenever one is added or removed (the key), so a new variant is never hidden.
        <DetailSection
          key={`new-variants-${draft.newVariants.length}`}
          title="New variants · added when you save"
          icon={BoxesIcon}
          count={draft.newVariants.length}
          defaultOpen={false}
          forceOpen
        >
          <NewVariantsEditor {...props} />
        </DetailSection>
      )}
    </div>
  )
}

function ExistingVariants({ product, draft, errors, onChange }: SectionProps) {
  // A product with a single variant opens it straight away; otherwise they start collapsed.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(draft.variants.length === 1 ? [draft.variants[0].key] : []),
  )

  const update = (index: number, patch: Partial<VariantDraft>) =>
    onChange({
      variants: draft.variants.map((variant, i) =>
        i === index ? { ...variant, ...patch } : variant,
      ),
    })

  const toggleOpen = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Removing marks the variant for deletion; it is only deleted in the store on Save.
  const remove = (index: number) => update(index, { removed: true })

  const imageOptions = (hasImage: boolean) => [
    { value: '', label: 'Keep the current image' },
    ...draft.images.map((image, index) => ({
      value: image.id,
      label: `Image ${index + 1}${image.alt ? ` — ${image.alt}` : ''}`,
    })),
    // Taking the picture off only makes sense for a variant that shows one.
    ...(hasImage ? [{ value: NO_IMAGE, label: 'No image' }] : []),
  ]

  return (
    <div className="flex flex-col gap-3">
      {errors.variants && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          {errors.variants}
        </p>
      )}

      <ul aria-label="Variants" className="flex flex-col gap-2.5">
        {draft.variants.map((variant, index) => {
          const isOpen = open.has(variant.key) && !variant.removed
          const hasError = Object.keys(errors).some((key) =>
            key.startsWith(`variants.${index}.`),
          )
          const bodyId = `variant-body-${variant.key}`
          const prefix = `variant-${variant.key}`

          return (
            <li
              key={variant.key}
              className={`rounded-xl border ${
                hasError ? 'border-danger' : 'border-border'
              } ${variant.removed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  disabled={variant.removed}
                  onClick={() => toggleOpen(variant.key)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent p-1 text-left disabled:cursor-default"
                >
                  <ChevronDownIcon
                    width={16}
                    height={16}
                    className={`text-text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                  <span className="border-border h-10 w-10 shrink-0 overflow-hidden border">
                    <ProductImage
                      src={variantPreviewUrl(
                        variant,
                        draft.images,
                        product.variants.find((original) => original.id === variant.id)
                          ?.image_url,
                      )}
                      alt=""
                      size="thumb"
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span
                      className={`truncate text-[0.9rem] font-semibold ${variant.removed ? 'line-through' : ''}`}
                    >
                      {variant.title}
                    </span>
                    {variant.sku.trim() && (
                      <span className="text-text-muted truncate text-[0.76rem]">
                        {variant.sku.trim()}
                      </span>
                    )}
                  </span>
                </button>
                {!variant.removed && (
                  <>
                    <span className="text-text w-24 shrink-0 text-right text-[0.85rem] font-medium">
                      {variant.price.trim()
                        ? formatPrice(variant.price, product.currency)
                        : ''}
                    </span>
                    <span className="text-text-muted hidden w-24 shrink-0 text-right text-[0.82rem] min-[480px]:inline">
                      {availableOf(variant)}
                    </span>
                  </>
                )}
                {variant.removed ? (
                  <>
                    <Badge tone="danger">Will be deleted</Badge>
                    <button
                      type="button"
                      className={TEXT_BUTTON}
                      onClick={() => update(index, { removed: false })}
                    >
                      Undo
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-label={`Remove variant ${variant.title}`}
                    onClick={() => remove(index)}
                    className={`${ICON_BUTTON} hover:text-danger`}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                )}
              </div>

              {isOpen && (
                <div
                  id={bodyId}
                  className="border-border bg-surface/40 grid grid-cols-1 items-start gap-5 border-t p-4 lg:grid-cols-2"
                >
                  {/* The same sections as Add product: Price, Shipping, Image. */}
                  <VariantPriceCard
                    product={product}
                    variant={variant}
                    index={index}
                    errors={errors}
                    prefix={prefix}
                    update={(patch) => update(index, patch)}
                  />
                  <VariantShippingCard
                    product={product}
                    variant={variant}
                    index={index}
                    errors={errors}
                    prefix={prefix}
                    update={(patch) => update(index, patch)}
                  />
                  <VariantImageCard
                    previewSrc={variantPreviewUrl(
                      variant,
                      draft.images,
                      product.variants.find((original) => original.id === variant.id)
                        ?.image_url,
                    )}
                    variant={variant}
                    index={index}
                    errors={errors}
                    prefix={prefix}
                    options={imageOptions(variant.hasImage)}
                    value={variant.removeImage ? NO_IMAGE : variant.imageId}
                    onChange={(choice) =>
                      update(
                        index,
                        choice === NO_IMAGE
                          ? { removeImage: true, imageId: '', imageUrl: '' }
                          : { removeImage: false, imageId: choice, imageUrl: '' },
                      )
                    }
                    onAddress={(imageUrl) =>
                      update(
                        index,
                        // An address replaces whatever picture was chosen from the list.
                        imageUrl.trim()
                          ? { imageUrl, imageId: '', removeImage: false }
                          : { imageUrl },
                      )
                    }
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** "25 available" from the quantities typed for the variant, or nothing when it has no stock rows. */
function availableOf(variant: VariantDraft): string {
  if (!variant.tracked || variant.stock.length === 0) return ''
  const total = variant.stock.reduce((sum, row) => {
    const amount = Number(row.available)
    return row.available.trim() !== '' && Number.isFinite(amount) ? sum + amount : sum
  }, 0)
  return `${total} available`
}

/** A quiet line in a closed card's header: what is inside, so it need not be opened to know. */
function Summary({ children }: { children: string }) {
  if (!children) return null
  return (
    <span className="text-text-muted mr-1 hidden max-w-[22rem] truncate text-[0.8rem] sm:inline">
      {children}
    </span>
  )
}

/** "Size · Color": the product's options, as they will be named. */
function optionNames(draft: SectionProps['draft']): string {
  return [
    ...draft.options.map((option) => option.newName.trim() || option.name),
    ...draft.addedOptions.map((option) => option.name.trim()).filter(Boolean),
  ].join(' · ')
}

/** "£50.00 – £62.00 · 75 available": the price range and the stock of the variants that stay. */
function variantSummary(draft: SectionProps['draft'], currency?: string | null): string {
  const kept = draft.variants.filter((variant) => !variant.removed)
  const prices = kept
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price) && price >= 0)
  const low = Math.min(...prices)
  const high = Math.max(...prices)
  const range =
    prices.length === 0
      ? ''
      : low === high
        ? formatPrice(String(low), currency)
        : `${formatPrice(String(low), currency)} – ${formatPrice(String(high), currency)}`
  const stock = kept.reduce((sum, variant) => {
    if (!variant.tracked) return sum
    return (
      sum +
      variant.stock.reduce((inner, row) => {
        const amount = Number(row.available)
        return row.available.trim() !== '' && Number.isFinite(amount)
          ? inner + amount
          : inner
      }, 0)
    )
  }, 0)
  const hasStock = kept.some((variant) => variant.tracked && variant.stock.length > 0)
  return [range, hasStock ? `${stock} available` : ''].filter(Boolean).join(' · ')
}
