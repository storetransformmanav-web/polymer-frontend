import { useId, useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { useProductStockLocations } from '../../hooks/useProductStockLocations.ts'
import { ChevronDownIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import { WEIGHT_UNITS, type WeightUnit } from '../../../../lib/api/endpoints.ts'
import { LIMITS, optionChoices, type NewVariantDraft } from '../../utils/editDraft.ts'
import { EditField, FIELD_INPUT, ICON_BUTTON, type SectionProps } from './fields.tsx'
import { StockFields } from './StockFields.tsx'

const UNIT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

/**
 * The variants being added (`variants` entries without an `id`): a value for each option, a
 * price, and optionally SKU, barcode, cost, weight, the stock at one location and a picture
 * (a public https address). They are created together with the rest of the edit's changes.
 */
export function NewVariantsEditor({ product, draft, errors, onChange }: SectionProps) {
  const choices = optionChoices(draft)
  const listId = useId()

  const locations = useProductStockLocations(product)
  // A new variant opens with its fields showing; its header folds it away.
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (key: string) =>
    setFolded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const patch = (index: number, change: Partial<NewVariantDraft>) =>
    onChange({
      newVariants: draft.newVariants.map((variant, i) =>
        i === index ? { ...variant, ...change } : variant,
      ),
    })
  const setValue = (index: number, position: number, value: string) => {
    const next = [...draft.newVariants[index].optionValues]
    while (next.length <= position) next.push('')
    next[position] = value
    patch(index, { optionValues: next })
  }

  return (
    <div className="flex flex-col gap-3">
      {draft.newVariants.length > 0 && (
        <ul aria-label="New variants" className="flex flex-col gap-2.5">
          {draft.newVariants.map((created, index) => {
            const at = (field: string) => errors[`newVariants.${index}.${field}`]
            const prefix = `new-variant-${created.key}`
            const bodyId = `${prefix}-body`
            const hasError = Object.keys(errors).some((key) =>
              key.startsWith(`newVariants.${index}.`),
            )
            const isOpen = !folded.has(created.key) || hasError
            return (
              <li
                key={created.key}
                className="border-accent/50 bg-accent-tint/20 rounded-xl border"
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    onClick={() => toggle(created.key)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent p-1 text-left"
                  >
                    <ChevronDownIcon
                      width={16}
                      height={16}
                      className={`text-text-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                    <span className="min-w-0 truncate text-[0.9rem] font-semibold">
                      {created.optionValues
                        .map((value) => value.trim())
                        .filter(Boolean)
                        .join(' / ') || `New variant ${index + 1}`}
                    </span>
                  </button>
                  <Badge tone="success">New</Badge>
                  <button
                    type="button"
                    aria-label={`Remove new variant ${index + 1}`}
                    onClick={() =>
                      onChange({
                        newVariants: draft.newVariants.filter((_, i) => i !== index),
                      })
                    }
                    className={`${ICON_BUTTON} hover:text-danger`}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>

                {isOpen && (
                  <div
                    id={bodyId}
                    className="border-border bg-bg flex flex-col gap-4 border-t p-4"
                  >
                    {at('options') && (
                      <p role="alert" className="text-danger text-[0.82rem] font-medium">
                        {at('options')}
                      </p>
                    )}

                    <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
                      {choices.map((choice, position) => (
                        <EditField
                          key={`${choice.name}-${position}`}
                          id={`${prefix}-option-${position}`}
                          label={choice.name}
                          error={at(`optionValues.${position}`)}
                        >
                          <input
                            id={`${prefix}-option-${position}`}
                            list={`${listId}-${index}-${position}`}
                            autoComplete="off"
                            value={created.optionValues[position] ?? ''}
                            maxLength={LIMITS.optionValue}
                            aria-invalid={
                              at(`optionValues.${position}`) ? true : undefined
                            }
                            onChange={(event) =>
                              setValue(index, position, event.target.value)
                            }
                            className={FIELD_INPUT}
                          />
                          <datalist id={`${listId}-${index}-${position}`}>
                            {choice.values.map((value) => (
                              <option key={value} value={value} />
                            ))}
                          </datalist>
                        </EditField>
                      ))}

                      <EditField
                        id={`${prefix}-price`}
                        label={`Price${product.currency ? ` (${product.currency})` : ''}`}
                        error={at('price')}
                      >
                        <input
                          id={`${prefix}-price`}
                          inputMode="decimal"
                          autoComplete="off"
                          value={created.price}
                          placeholder="0.00"
                          aria-invalid={at('price') ? true : undefined}
                          onChange={(event) =>
                            patch(index, { price: event.target.value })
                          }
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
                          value={created.compareAtPrice}
                          placeholder="0.00"
                          aria-invalid={at('compareAtPrice') ? true : undefined}
                          onChange={(event) =>
                            patch(index, { compareAtPrice: event.target.value })
                          }
                          className={FIELD_INPUT}
                        />
                      </EditField>
                      <EditField
                        id={`${prefix}-sku`}
                        label="SKU"
                        optional
                        error={at('sku')}
                      >
                        <input
                          id={`${prefix}-sku`}
                          autoComplete="off"
                          value={created.sku}
                          onChange={(event) => patch(index, { sku: event.target.value })}
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
                          value={created.barcode}
                          onChange={(event) =>
                            patch(index, { barcode: event.target.value })
                          }
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
                          value={created.cost}
                          placeholder="0.00"
                          aria-invalid={at('cost') ? true : undefined}
                          onChange={(event) => patch(index, { cost: event.target.value })}
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
                            value={created.weight}
                            placeholder="0"
                            aria-invalid={at('weight') ? true : undefined}
                            onChange={(event) =>
                              patch(index, { weight: event.target.value })
                            }
                            className={FIELD_INPUT}
                          />
                        </EditField>
                        <SelectField
                          id={`${prefix}-unit`}
                          label="Unit"
                          value={created.weightUnit}
                          options={UNIT_OPTIONS}
                          onChange={(unit) =>
                            patch(index, { weightUnit: unit as WeightUnit })
                          }
                        />
                      </div>

                      <fieldset className="m-0 min-w-0 border-0 p-0 min-[480px]:col-span-2 lg:col-span-3">
                        <legend className="text-text mb-1.5 p-0 text-[0.82rem] font-semibold">
                          Opening stock{' '}
                          <span className="text-text-muted font-normal">(optional)</span>
                        </legend>
                        <StockFields
                          rows={created.stock}
                          onChange={(stock) => patch(index, { stock })}
                          locations={locations}
                          errors={errors}
                          prefix={`newVariants.${index}.stock`}
                          label={`Stock of new variant ${index + 1}`}
                        />
                      </fieldset>

                      <div className="min-[480px]:col-span-2 lg:col-span-3">
                        <EditField
                          id={`${prefix}-image`}
                          label="Image address"
                          optional
                          error={at('imageUrl')}
                          hint="A public https:// link to its picture."
                        >
                          <input
                            id={`${prefix}-image`}
                            inputMode="url"
                            autoComplete="off"
                            spellCheck={false}
                            value={created.imageUrl}
                            placeholder="https://…"
                            aria-invalid={at('imageUrl') ? true : undefined}
                            onChange={(event) =>
                              patch(index, { imageUrl: event.target.value })
                            }
                            className={FIELD_INPUT}
                          />
                        </EditField>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {errors.newVariants && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          {errors.newVariants}
        </p>
      )}
    </div>
  )
}
