import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { ChevronDownIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  WEIGHT_UNITS,
  type InventoryPolicy,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../../lib/format.ts'
import { LIMITS, type VariantDraft } from '../../utils/editDraft.ts'
import { useProductStockLocations } from '../../hooks/useProductStockLocations.ts'
import { NewVariantsEditor } from './NewVariantsEditor.tsx'
import { StockFields } from './StockFields.tsx'
import { VariantOptionsEditor } from './VariantOptionsEditor.tsx'
import {
  CheckField,
  EditField,
  FIELD_INPUT,
  ICON_BUTTON,
  TEXT_BUTTON,
  type SectionProps,
} from './fields.tsx'

/** The Image dropdown's choice for "take the picture off this variant". */
const NO_IMAGE = 'none'

const POLICY_OPTIONS = [
  { value: 'DENY', label: 'Stop selling when out of stock' },
  { value: 'CONTINUE', label: 'Keep selling when out of stock' },
]

const UNIT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

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
  const locations = useProductStockLocations(product)
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
          const at = (field: string) => errors[`variants.${index}.${field}`]
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
                  className="border-border grid grid-cols-1 gap-4 border-t p-4 min-[480px]:grid-cols-2"
                >
                  <EditField
                    id={`${prefix}-price`}
                    label={`Price${product.currency ? ` (${product.currency})` : ''}`}
                    error={at('price')}
                  >
                    <input
                      id={`${prefix}-price`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={variant.price}
                      placeholder="0.00"
                      aria-invalid={at('price') ? true : undefined}
                      onChange={(event) => update(index, { price: event.target.value })}
                      className={FIELD_INPUT}
                    />
                  </EditField>
                  <EditField
                    id={`${prefix}-compare`}
                    label="Compare-at price"
                    optional
                    error={at('compareAtPrice')}
                  >
                    <input
                      id={`${prefix}-compare`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={variant.compareAtPrice}
                      placeholder="0.00"
                      aria-invalid={at('compareAtPrice') ? true : undefined}
                      onChange={(event) =>
                        update(index, { compareAtPrice: event.target.value })
                      }
                      className={FIELD_INPUT}
                    />
                  </EditField>
                  <EditField
                    id={`${prefix}-sku`}
                    label="SKU"
                    error={at('sku')}
                    counter={{ value: variant.sku.trim().length, max: LIMITS.sku }}
                  >
                    <input
                      id={`${prefix}-sku`}
                      autoComplete="off"
                      value={variant.sku}
                      onChange={(event) => update(index, { sku: event.target.value })}
                      className={FIELD_INPUT}
                    />
                  </EditField>
                  <EditField
                    id={`${prefix}-barcode`}
                    label="Barcode"
                    optional
                    error={at('barcode')}
                  >
                    <input
                      id={`${prefix}-barcode`}
                      autoComplete="off"
                      value={variant.barcode}
                      onChange={(event) => update(index, { barcode: event.target.value })}
                      className={FIELD_INPUT}
                    />
                  </EditField>
                  <EditField
                    id={`${prefix}-cost`}
                    label="Cost per item"
                    optional
                    error={at('cost')}
                  >
                    <input
                      id={`${prefix}-cost`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={variant.cost}
                      placeholder="0.00"
                      aria-invalid={at('cost') ? true : undefined}
                      onChange={(event) => update(index, { cost: event.target.value })}
                      className={FIELD_INPUT}
                    />
                  </EditField>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                    <EditField
                      id={`${prefix}-weight`}
                      label="Weight"
                      optional
                      error={at('weight')}
                    >
                      <input
                        id={`${prefix}-weight`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={variant.weight}
                        placeholder="0"
                        aria-invalid={at('weight') ? true : undefined}
                        onChange={(event) =>
                          update(index, { weight: event.target.value })
                        }
                        className={FIELD_INPUT}
                      />
                    </EditField>
                    <SelectField
                      id={`${prefix}-unit`}
                      label="Unit"
                      value={variant.weightUnit}
                      options={UNIT_OPTIONS}
                      onChange={(unit) =>
                        update(index, { weightUnit: unit as WeightUnit })
                      }
                    />
                  </div>

                  <div className="min-[480px]:col-span-2">
                    <SelectField
                      id={`${prefix}-policy`}
                      label="When out of stock"
                      value={variant.inventoryPolicy}
                      options={POLICY_OPTIONS}
                      onChange={(policy) =>
                        update(index, { inventoryPolicy: policy as InventoryPolicy })
                      }
                    />
                  </div>
                  {imageOptions(variant.hasImage).length > 1 && (
                    <div className="min-[480px]:col-span-2">
                      <SelectField
                        id={`${prefix}-image`}
                        label="Image"
                        value={variant.removeImage ? NO_IMAGE : variant.imageId}
                        options={imageOptions(variant.hasImage)}
                        onChange={(choice) =>
                          update(
                            index,
                            choice === NO_IMAGE
                              ? { removeImage: true, imageId: '' }
                              : { removeImage: false, imageId: choice },
                          )
                        }
                      />
                    </div>
                  )}
                  <fieldset className="m-0 min-w-0 border-0 p-0 min-[480px]:col-span-2">
                    <legend className="text-text mb-1.5 p-0 text-[0.82rem] font-semibold">
                      Stock
                    </legend>
                    <StockFields
                      rows={variant.stock}
                      onChange={(stock) => update(index, { stock })}
                      locations={locations}
                      errors={errors}
                      prefix={`variants.${index}.stock`}
                      label={`Stock of ${variant.title}`}
                    />
                  </fieldset>
                  <EditField
                    id={`${prefix}-taxcode`}
                    label="Tax code"
                    optional
                    error={at('taxCode')}
                    hint="Leave blank to keep the current code."
                  >
                    <input
                      id={`${prefix}-taxcode`}
                      autoComplete="off"
                      value={variant.taxCode}
                      aria-invalid={at('taxCode') ? true : undefined}
                      onChange={(event) => update(index, { taxCode: event.target.value })}
                      className={FIELD_INPUT}
                    />
                  </EditField>
                  <div className="flex flex-wrap gap-x-6 gap-y-2.5 min-[480px]:col-span-2">
                    <CheckField
                      label="Charge tax"
                      checked={variant.taxable}
                      onChange={(taxable) => update(index, { taxable })}
                    />
                    <CheckField
                      label="Track stock"
                      checked={variant.tracked}
                      onChange={(tracked) => update(index, { tracked })}
                    />
                    <CheckField
                      label="Needs shipping"
                      checked={variant.requiresShipping}
                      onChange={(requiresShipping) => update(index, { requiresShipping })}
                    />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
