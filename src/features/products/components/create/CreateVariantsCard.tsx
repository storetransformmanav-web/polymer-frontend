import { PlusIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  WEIGHT_UNITS,
  type StockLocation,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import {
  blankOption,
  CREATE_LIMITS,
  type CreateOptionDraft,
  type CreateVariantDraft,
} from '../../utils/createDraft.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { TagsInput } from '../edit/TagsSection.tsx'
import {
  CheckField,
  EditField,
  FIELD_INPUT,
  ICON_BUTTON,
  TEXT_BUTTON,
} from '../edit/fields.tsx'
import { CreateCard, type CreateSectionProps } from './CreateCard.tsx'

const WEIGHT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

const CELL =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-9 w-full min-w-0 rounded-lg border px-2.5 text-[0.85rem] outline-none focus:outline-2 aria-[invalid=true]:border-danger'

const TH =
  'text-text-muted border-border bg-accent-tint/60 border-b px-2.5 py-2 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase'

interface VariantsCardProps extends CreateSectionProps {
  /** The store's stock locations (empty when none are known). */
  locations: StockLocation[]
  /** The picture URLs listed under Media, for choosing a variant's picture. */
  pictures: string[]
}

const variantName = (variant: CreateVariantDraft) => variant.optionValues.join(' / ')

/**
 * Options (Size, Colour…) and the variants they make. Without options there is
 * one variant, edited as plain fields; with options every combination of the
 * values is a row to price. What variants share — weight, tax, shipping, stock
 * tracking — is set once below.
 */
export function CreateVariantsCard({
  draft,
  errors,
  update,
  locations,
  pictures,
}: VariantsCardProps) {
  const single =
    draft.variants.length === 1 && draft.variants[0].optionValues.length === 0

  const setOption = (index: number, patch: Partial<CreateOptionDraft>) =>
    update({
      options: draft.options.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    })

  const setVariant = (index: number, patch: Partial<CreateVariantDraft>) =>
    update({
      variants: draft.variants.map((variant, i) =>
        i === index ? { ...variant, ...patch } : variant,
      ),
    })

  const stockHere = draft.locationId !== ''

  return (
    <CreateCard
      title="Options and variants"
      description="Add options if the product comes in sizes, colours… — every combination becomes a variant with its own price."
    >
      {/* Options */}
      <div className="flex flex-col gap-3">
        {draft.options.map((option, index) => (
          <div
            key={option.key}
            className="border-border flex items-start gap-3 rounded-xl border p-3"
          >
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[520px]:grid-cols-[12rem_minmax(0,1fr)]">
              <EditField
                id={`create-option-name-${option.key}`}
                label="Option name"
                error={errors[`options.${index}.name`]}
              >
                <input
                  id={`create-option-name-${option.key}`}
                  autoComplete="off"
                  value={option.name}
                  maxLength={255}
                  placeholder="Size"
                  aria-invalid={errors[`options.${index}.name`] ? true : undefined}
                  onChange={(event) => setOption(index, { name: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              <EditField
                id={`create-option-values-${option.key}`}
                label="Option values"
                error={errors[`options.${index}.values`]}
              >
                <TagsInput
                  id={`create-option-values-${option.key}`}
                  ariaLabel={`Add values for option ${index + 1}`}
                  listLabel={`Values of option ${index + 1}`}
                  tags={option.values}
                  onChange={(values) => setOption(index, { values })}
                  placeholder="Small, Medium, Large"
                />
              </EditField>
            </div>
            <button
              type="button"
              aria-label={`Remove option ${index + 1}`}
              onClick={() =>
                update({ options: draft.options.filter((_, i) => i !== index) })
              }
              className={`${ICON_BUTTON} hover:text-danger mt-6`}
            >
              <TrashIcon width={16} height={16} />
            </button>
          </div>
        ))}
        {errors.options && (
          <p role="alert" className="text-danger text-[0.78rem]">
            {errors.options}
          </p>
        )}
        <button
          type="button"
          onClick={() => update({ options: [...draft.options, blankOption()] })}
          disabled={draft.options.length >= CREATE_LIMITS.options}
          className={`${TEXT_BUTTON} self-start disabled:pointer-events-none disabled:opacity-50`}
        >
          <PlusIcon width={14} height={14} />
          {draft.options.length === 0
            ? 'Add options like size or colour'
            : 'Add another option'}
        </button>
      </div>

      {errors.variants && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          {errors.variants}
        </p>
      )}

      {/* Variants */}
      {single ? (
        <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3">
          <EditField id="create-price" label="Price" error={errors['variants.0.price']}>
            <input
              id="create-price"
              inputMode="decimal"
              autoComplete="off"
              value={draft.variants[0].price}
              placeholder="0.00"
              aria-invalid={errors['variants.0.price'] ? true : undefined}
              onChange={(event) => setVariant(0, { price: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
          <EditField
            id="create-compare"
            label="Compare-at price"
            optional
            error={errors['variants.0.compareAtPrice']}
          >
            <input
              id="create-compare"
              inputMode="decimal"
              autoComplete="off"
              value={draft.variants[0].compareAtPrice}
              onChange={(event) => setVariant(0, { compareAtPrice: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
          <EditField
            id="create-cost"
            label="Cost per item"
            optional
            error={errors['variants.0.cost']}
          >
            <input
              id="create-cost"
              inputMode="decimal"
              autoComplete="off"
              value={draft.variants[0].cost}
              onChange={(event) => setVariant(0, { cost: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
          <EditField
            id="create-sku"
            label="SKU"
            optional
            error={errors['variants.0.sku']}
          >
            <input
              id="create-sku"
              autoComplete="off"
              value={draft.variants[0].sku}
              maxLength={LIMITS.sku + 50}
              onChange={(event) => setVariant(0, { sku: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
          <EditField
            id="create-barcode"
            label="Barcode"
            optional
            error={errors['variants.0.barcode']}
          >
            <input
              id="create-barcode"
              autoComplete="off"
              value={draft.variants[0].barcode}
              maxLength={LIMITS.barcode + 50}
              onChange={(event) => setVariant(0, { barcode: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
          {stockHere && (
            <EditField
              id="create-stock"
              label="Opening stock"
              optional
              error={errors['variants.0.stock']}
            >
              <input
                id="create-stock"
                inputMode="numeric"
                autoComplete="off"
                value={draft.variants[0].stock}
                placeholder="0"
                onChange={(event) => setVariant(0, { stock: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
          )}
          {pictures.length > 0 && (
            <SelectField
              id="create-variant-image"
              label="Picture"
              value={draft.variants[0].imageUrl}
              options={[
                { value: '', label: 'Product picture' },
                ...pictures.map((url) => ({ value: url, label: url })),
              ]}
              onChange={(imageUrl) => setVariant(0, { imageUrl })}
            />
          )}
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] border-collapse text-[0.85rem]">
            <thead>
              <tr>
                <th className={TH}>Variant</th>
                <th className={`${TH} w-28`}>Price</th>
                <th className={`${TH} w-28`}>Compare-at</th>
                <th className={`${TH} w-24`}>Cost</th>
                <th className={`${TH} w-32`}>SKU</th>
                <th className={`${TH} w-32`}>Barcode</th>
                {stockHere && <th className={`${TH} w-24`}>Stock</th>}
                {pictures.length > 0 && <th className={`${TH} w-40`}>Picture</th>}
              </tr>
            </thead>
            <tbody>
              {draft.variants.map((variant, index) => {
                const name = variantName(variant)
                const at = (field: string) => errors[`variants.${index}.${field}`]
                return (
                  <tr
                    key={variant.key}
                    className="border-border border-b last:border-b-0"
                  >
                    <td className="px-2.5 py-2 font-medium whitespace-nowrap">{name}</td>
                    <td className="px-1.5 py-1.5">
                      <input
                        aria-label={`Price for ${name}`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={variant.price}
                        aria-invalid={at('price') ? true : undefined}
                        title={at('price')}
                        onChange={(event) =>
                          setVariant(index, { price: event.target.value })
                        }
                        className={CELL}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        aria-label={`Compare-at price for ${name}`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={variant.compareAtPrice}
                        aria-invalid={at('compareAtPrice') ? true : undefined}
                        title={at('compareAtPrice')}
                        onChange={(event) =>
                          setVariant(index, { compareAtPrice: event.target.value })
                        }
                        className={CELL}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        aria-label={`Cost for ${name}`}
                        inputMode="decimal"
                        autoComplete="off"
                        value={variant.cost}
                        aria-invalid={at('cost') ? true : undefined}
                        title={at('cost')}
                        onChange={(event) =>
                          setVariant(index, { cost: event.target.value })
                        }
                        className={CELL}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        aria-label={`SKU for ${name}`}
                        autoComplete="off"
                        value={variant.sku}
                        aria-invalid={at('sku') ? true : undefined}
                        title={at('sku')}
                        onChange={(event) =>
                          setVariant(index, { sku: event.target.value })
                        }
                        className={CELL}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        aria-label={`Barcode for ${name}`}
                        autoComplete="off"
                        value={variant.barcode}
                        aria-invalid={at('barcode') ? true : undefined}
                        title={at('barcode')}
                        onChange={(event) =>
                          setVariant(index, { barcode: event.target.value })
                        }
                        className={CELL}
                      />
                    </td>
                    {stockHere && (
                      <td className="px-1.5 py-1.5">
                        <input
                          aria-label={`Stock for ${name}`}
                          inputMode="numeric"
                          autoComplete="off"
                          value={variant.stock}
                          aria-invalid={at('stock') ? true : undefined}
                          title={at('stock')}
                          onChange={(event) =>
                            setVariant(index, { stock: event.target.value })
                          }
                          className={CELL}
                        />
                      </td>
                    )}
                    {pictures.length > 0 && (
                      <td className="px-1.5 py-1.5">
                        <select
                          aria-label={`Picture for ${name}`}
                          value={variant.imageUrl}
                          onChange={(event) =>
                            setVariant(index, { imageUrl: event.target.value })
                          }
                          className={CELL}
                        >
                          <option value="">Product picture</option>
                          {pictures.map((url, i) => (
                            <option key={url} value={url}>
                              {`Picture ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* What every variant shares */}
      <div className="border-border flex flex-col gap-4 border-t pt-4">
        <p className="text-[0.85rem] font-semibold">
          Shipping, tax and stock — for every variant
        </p>
        <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
          <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
            <EditField id="create-weight" label="Weight" optional error={errors.weight}>
              <input
                id="create-weight"
                inputMode="decimal"
                autoComplete="off"
                value={draft.weight}
                aria-invalid={errors.weight ? true : undefined}
                onChange={(event) => update({ weight: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
            <SelectField
              id="create-weight-unit"
              label="Unit"
              value={draft.weightUnit}
              options={WEIGHT_OPTIONS}
              onChange={(weightUnit) => update({ weightUnit: weightUnit as WeightUnit })}
            />
          </div>
          {locations.length === 0 && (
            <EditField
              id="create-location-id"
              label="Opening stock location ID"
              optional
              error={errors.locationId}
              hint="This store has no stock locations on record yet. To set opening stock, enter your Shopify location ID (Shopify admin → Settings → Locations: the number at the end of the address), then a quantity for each variant."
            >
              <input
                id="create-location-id"
                inputMode="numeric"
                autoComplete="off"
                value={draft.locationId}
                placeholder="e.g. 72843812"
                aria-invalid={errors.locationId ? true : undefined}
                onChange={(event) =>
                  // Digits only: it is a Shopify location number.
                  update({ locationId: event.target.value.replace(/\D/g, '') })
                }
                className={FIELD_INPUT}
              />
            </EditField>
          )}
          {locations.length > 0 && (
            <SelectField
              id="create-location"
              label="Opening stock location"
              value={draft.locationId}
              options={[
                { value: '', label: 'No opening stock' },
                ...locations.map((location) => ({
                  value: String(location.id),
                  label: location.name || `Location ${location.id}`,
                })),
              ]}
              onChange={(locationId) => update({ locationId })}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <CheckField
            label="Charge tax"
            checked={draft.taxable}
            onChange={(taxable) => update({ taxable })}
          />
          <CheckField
            label="Requires shipping"
            checked={draft.requiresShipping}
            onChange={(requiresShipping) => update({ requiresShipping })}
          />
          <CheckField
            label="Track stock"
            checked={draft.tracked}
            onChange={(tracked) => update({ tracked })}
          />
          <CheckField
            label="Keep selling when out of stock"
            checked={draft.inventoryPolicy === 'CONTINUE'}
            onChange={(on) => update({ inventoryPolicy: on ? 'CONTINUE' : 'DENY' })}
          />
        </div>
      </div>
    </CreateCard>
  )
}
