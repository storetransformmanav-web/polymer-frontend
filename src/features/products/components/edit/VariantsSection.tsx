import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { ChevronDownIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { formatPrice } from '../../../../lib/format.ts'
import { variantPreviewUrl, type VariantDraft } from '../../utils/editDraft.ts'
import { ProductImage } from '../ProductImage.tsx'
import { NewVariantsEditor } from './NewVariantsEditor.tsx'
import { PageCard } from './PageCard.tsx'
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
    // The small type of the product list (0.85rem body, 0.75rem labels): the boxes, labels and
    // dropdowns of this editor are set a size down from the forms'.
    <div className="flex flex-col gap-4 [&_input]:text-[0.82rem] [&_input:not([type=checkbox]):not([type=radio])]:h-9 [&_label]:text-[0.75rem] [&_select]:text-[0.8rem] [&_textarea]:text-[0.82rem]">
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

      {/* The page's cards: the options (Size, Colour…), then every variant, then the new ones. */}
      <VariantOptionsEditor {...props} />

      <PageCard
        title="Current variants"
        count={draft.variants.length}
        aside={
          <Summary>{variantSummary(draft.variants, props.product.currency)}</Summary>
        }
        problem={problemIn('variants')}
        flush
      >
        <ExistingVariants {...props} />
      </PageCard>

      {draft.newVariants.length > 0 && (
        <PageCard
          title="New variants · added when you save"
          count={draft.newVariants.length}
          problem={problemIn('newVariants')}
        >
          <NewVariantsEditor {...props} />
        </PageCard>
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

  // With two or more options the variants are grouped under the first one (Small, Medium…), like
  // the Variants tab's own list: a group is an accordion row, closed to begin with.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  const toggleGroup = (name: string) =>
    setOpenGroups((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  const groups = groupByFirstOption(product, draft.variants)

  const imageOptions = (hasImage: boolean) => [
    { value: '', label: 'Keep the current image' },
    ...draft.images.map((image, index) => ({
      value: image.id,
      label: `Image ${index + 1}${image.alt ? ` — ${image.alt}` : ''}`,
    })),
    // Taking the picture off only makes sense for a variant that shows one.
    ...(hasImage ? [{ value: NO_IMAGE, label: 'No image' }] : []),
  ]

  /** One variant's row (and, opened, its cards); `label` is what a group leaves to say ("Red"). */
  const renderVariant = (variant: VariantDraft, index: number, label?: string) => {
    const isOpen = open.has(variant.key) && !variant.removed
    const hasError = Object.keys(errors).some((key) =>
      key.startsWith(`variants.${index}.`),
    )
    const bodyId = `variant-body-${variant.key}`
    const prefix = `variant-${variant.key}`

    return (
      <li
        key={variant.key}
        className={`border-b last:border-b-0 ${
          hasError ? 'border-danger' : 'border-border-strong'
        } ${variant.removed ? 'opacity-60' : ''} ${isOpen ? 'bg-accent-tint/30' : ''}`}
      >
        <div
          className={`hover:bg-accent-tint/60 flex min-h-16 items-center gap-3 py-2 pr-5 transition-colors ${
            label === undefined ? 'pl-5' : 'pl-12'
          }`}
        >
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
            <span className="border-border h-11 w-11 shrink-0 overflow-hidden border">
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
                {label ?? variant.title}
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
              <span className="text-text w-28 shrink-0 text-right text-[0.9rem] font-semibold">
                {variant.price.trim() ? formatPrice(variant.price, product.currency) : ''}
              </span>
              <span className="text-text-muted hidden w-32 shrink-0 text-right text-[0.82rem] min-[480px]:inline">
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
            className="border-border-strong bg-bg grid grid-cols-1 items-start gap-6 border-t p-5 lg:grid-cols-2"
          >
            {/* Price and shipping on the left, the picture on the right (stacked on a phone). */}
            <div className="flex flex-col gap-5">
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
            </div>
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
  }

  return (
    <div className="flex flex-col">
      {errors.variants && (
        <p role="alert" className="text-danger px-5 py-3 text-[0.82rem] font-medium">
          {errors.variants}
        </p>
      )}

      <ul aria-label="Variants" className="flex flex-col">
        {groups
          ? groups.map((group) => {
              const members = group.indexes.map((index) => draft.variants[index])
              const hasError = group.indexes.some((index) =>
                Object.keys(errors).some((key) => key.startsWith(`variants.${index}.`)),
              )
              // A problem inside a group opens it, so it is never hidden.
              const isOpen = openGroups.has(group.name) || hasError
              return (
                <li
                  key={group.name}
                  className="border-border-strong border-b last:border-b-0"
                >
                  <GroupRow
                    name={group.name}
                    variants={members}
                    open={isOpen}
                    currency={product.currency}
                    // A group of several variants has no picture of its own (not the first
                    // one's); a group of one shows that variant's.
                    picture={
                      members.length > 1
                        ? null
                        : variantPreviewUrl(
                            members[0],
                            draft.images,
                            product.variants.find(
                              (original) => original.id === members[0].id,
                            )?.image_url,
                          )
                    }
                    onToggle={() => toggleGroup(group.name)}
                  />
                  {isOpen && (
                    <ul aria-label={`${group.name} variants`} className="flex flex-col">
                      {group.indexes.map((index) =>
                        renderVariant(draft.variants[index], index, group.labels[index]),
                      )}
                    </ul>
                  )}
                </li>
              )
            })
          : draft.variants.map((variant, index) => renderVariant(variant, index))}
      </ul>
    </div>
  )
}

/**
 * The variants grouped by the value of the product's first option — "Small" holds Small / Red and
 * Small / Black — as the indexes into the draft's variants plus what each is called inside the
 * group (its other values, "Red"). Null when there is nothing to group by: fewer than two options
 * (or only the default variant), or a variant that does not say its value.
 */
function groupByFirstOption(
  product: SectionProps['product'],
  variants: VariantDraft[],
): { name: string; indexes: number[]; labels: Record<number, string> }[] | null {
  const options = product.has_only_default_variant
    ? []
    : [...product.options].sort((a, b) => a.position - b.position)
  if (options.length < 2) return null
  const first = options[0].name
  const groups = new Map<string, { indexes: number[]; labels: Record<number, string> }>()
  for (const [index, variant] of variants.entries()) {
    const chosen = product.variants.find(
      (original) => original.id === variant.id,
    )?.selected_options
    const value = chosen?.find((entry) => entry.name === first)?.value
    if (!chosen || !value) return null
    const group = groups.get(value) ?? { indexes: [], labels: {} }
    group.indexes.push(index)
    group.labels[index] =
      chosen
        .filter((entry) => entry.name !== first)
        .map((entry) => entry.value)
        .join(' / ') || variant.title
    groups.set(value, group)
  }
  return [...groups].map(([name, group]) => ({ name, ...group }))
}

/** A group's accordion row: its picture, its name and variant count, price range and total stock. */
function GroupRow({
  name,
  variants,
  open,
  currency,
  picture,
  onToggle,
}: {
  name: string
  variants: VariantDraft[]
  open: boolean
  currency?: string | null
  picture: string | null
  onToggle: () => void
}) {
  const kept = variants.filter((variant) => !variant.removed)
  const count = `${kept.length} ${kept.length === 1 ? 'variant' : 'variants'}`
  return (
    <div className="hover:bg-accent-tint/60 flex min-h-16 items-center gap-3 px-5 py-2 transition-colors">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${name}, ${count}`}
        onClick={onToggle}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent p-1 text-left"
      >
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
        <span className="border-border h-11 w-11 shrink-0 overflow-hidden border">
          <ProductImage src={picture} alt="" size="thumb" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[0.9rem] font-semibold">{name}</span>
          <span className="text-text-muted text-[0.76rem]">{count}</span>
        </span>
      </button>
      <span className="text-text hidden min-w-0 truncate text-right text-[0.9rem] font-semibold sm:inline">
        {variantSummary(kept, currency)}
      </span>
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

/** "£50.00 – £62.00 · 75 available": the price range and the stock of the variants that stay. */
function variantSummary(variants: VariantDraft[], currency?: string | null): string {
  const kept = variants.filter((variant) => !variant.removed)
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
