import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { ChevronDownIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { formatPrice } from '../../../../lib/format.ts'
import { type VariantDraft } from '../../utils/editDraft.ts'
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
 * The Variants editor. On top, the product's **options** (rename an option or its values, add an
 * option); then every variant of the product as a collapsible card — price, SKU, stock policy,
 * the **stock at each location**, its picture (another one, or none) and so on, which can be
 * edited or removed (deleted in the store on save); and last, **Add variant** for new ones.
 */
export function VariantsSection(props: SectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <VariantOptionsEditor {...props} />
      <ExistingVariants {...props} />
      <NewVariantsEditor {...props} />
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
                  <span
                    className={`truncate text-[0.9rem] font-semibold ${variant.removed ? 'line-through' : ''}`}
                  >
                    {variant.title}
                  </span>
                </button>
                {!variant.removed && (
                  <span className="text-text-muted shrink-0 text-[0.82rem]">
                    {variant.price.trim()
                      ? formatPrice(variant.price, product.currency)
                      : ''}
                  </span>
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
                  className="border-border bg-surface/40 flex flex-col gap-5 border-t p-4"
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
