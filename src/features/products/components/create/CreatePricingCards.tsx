import { useState } from 'react'
import { Switch } from '../../../../components/ui/Switch.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import {
  WEIGHT_UNITS,
  type StockLocation,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import { CREATE_LIMITS, type CreateVariantDraft } from '../../utils/createDraft.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { CheckField, EditField, FIELD_INPUT } from '../edit/fields.tsx'
import { CardFooter, Chip, CreateCard, type CreateSectionProps } from './CreateCard.tsx'

const WEIGHT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

/** A product without options has exactly one variant, edited as plain fields. */
export const isSingleVariant = (variants: CreateVariantDraft[]) =>
  variants.length === 1 && variants[0].optionValues.length === 0

/** Sets one field of the only variant. */
function singleVariantSetter({ draft, update }: CreateSectionProps) {
  return (patch: Partial<CreateVariantDraft>) =>
    update({ variants: draft.variants.map((variant) => ({ ...variant, ...patch })) })
}

/**
 * **Price** — the price of a product without options (with options every variant is priced in
 * the Variants table), and a footer of pills — Compare-at · Charge tax · Cost per item — that
 * open the card's other fields: compare-at price, cost per item, whether tax is charged and
 * the tax code (the last two apply to every variant).
 */
export function CreatePriceCard(props: CreateSectionProps) {
  const { draft, errors, update } = props
  const [open, setOpen] = useState(false)
  const single = isSingleVariant(draft.variants)
  const setVariant = singleVariantSetter(props)
  const variant = draft.variants[0]
  const opened =
    open ||
    Boolean(
      errors['variants.0.compareAtPrice'] || errors['variants.0.cost'] || errors.taxCode,
    )

  return (
    <CreateCard
      title="Price"
      regionLabel="Pricing"
      description="What customers pay for this product."
    >
      {single ? (
        <div className="max-w-xs">
          <EditField id="create-price" label="Price" error={errors['variants.0.price']}>
            <input
              id="create-price"
              inputMode="decimal"
              autoComplete="off"
              value={variant.price}
              placeholder="0.00"
              aria-invalid={errors['variants.0.price'] ? true : undefined}
              onChange={(event) => setVariant({ price: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
        </div>
      ) : (
        <p className="text-text-muted text-[0.85rem]">
          This product has options, so each variant is priced in the Variants table below.
        </p>
      )}

      <CardFooter
        open={opened}
        onToggle={() => setOpen(!opened)}
        chips={
          <>
            {single && (
              <Chip
                value={variant.compareAtPrice.trim() || undefined}
                onClick={() => setOpen(true)}
              >
                Compare-at
              </Chip>
            )}
            <Chip value={draft.taxable ? 'Yes' : 'No'} onClick={() => setOpen(true)}>
              Charge tax
            </Chip>
            {single && (
              <Chip
                value={variant.cost.trim() || undefined}
                onClick={() => setOpen(true)}
              >
                Cost per item
              </Chip>
            )}
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
          {single && (
            <>
              <EditField
                id="create-compare"
                label="Compare-at price"
                error={errors['variants.0.compareAtPrice']}
                hint="The original price, shown crossed out next to the price (for a sale)."
              >
                <input
                  id="create-compare"
                  inputMode="decimal"
                  autoComplete="off"
                  value={variant.compareAtPrice}
                  onChange={(event) => setVariant({ compareAtPrice: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              <EditField
                id="create-cost"
                label="Cost per item"
                error={errors['variants.0.cost']}
                hint="What it costs you. Customers never see this."
              >
                <input
                  id="create-cost"
                  inputMode="decimal"
                  autoComplete="off"
                  value={variant.cost}
                  onChange={(event) => setVariant({ cost: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
            </>
          )}
          <EditField
            id="create-tax-code"
            label="Tax code"
            error={errors.taxCode}
            hint="Optional. Only needed for special tax rules; most products leave it blank."
            counter={{ value: draft.taxCode.trim().length, max: CREATE_LIMITS.taxCode }}
          >
            <input
              id="create-tax-code"
              autoComplete="off"
              value={draft.taxCode}
              aria-invalid={errors.taxCode ? true : undefined}
              onChange={(event) => update({ taxCode: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
        </div>
        <CheckField
          label="Charge tax on this product"
          hint="Tax is added at checkout using your store's tax settings. This applies to every variant."
          checked={draft.taxable}
          onChange={(taxable) => update({ taxable })}
        />
      </CardFooter>
    </CreateCard>
  )
}

/**
 * **Inventory** — the "Inventory tracked" switch; while it is on, where the opening stock goes
 * (a location of the store, or its Shopify location number when none is on record) and, for a
 * product without options, how many. A footer of pills — SKU · Barcodes · Sell when out of
 * stock — opens the SKU and barcode fields (with options they are columns of the variants
 * table) and toggles whether to keep selling at zero.
 */
export function CreateInventoryCard(
  props: CreateSectionProps & {
    /** The store's stock locations (empty when none are known). */
    locations: StockLocation[]
  },
) {
  const { draft, errors, update, locations } = props
  const [open, setOpen] = useState(false)
  const single = isSingleVariant(draft.variants)
  const setVariant = singleVariantSetter(props)
  const variant = draft.variants[0]
  const stockHere = draft.locationId !== ''
  const keepSelling = draft.inventoryPolicy === 'CONTINUE'
  const opened = open || Boolean(errors['variants.0.sku'] || errors['variants.0.barcode'])

  function setTracked(tracked: boolean) {
    // Opening stock only makes sense while stock is tracked: switching it off drops it.
    update(
      tracked
        ? { tracked }
        : {
            tracked,
            locationId: '',
            variants: draft.variants.map((item) => ({ ...item, stock: '' })),
          },
    )
  }

  return (
    <CreateCard
      title="Inventory"
      description="Whether the store counts your stock, and where the first units go."
      action={
        <Switch label="Inventory tracked" checked={draft.tracked} onChange={setTracked} />
      }
    >
      {draft.tracked ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 items-start gap-4 min-[520px]:grid-cols-[minmax(0,1fr)_10rem]">
            {locations.length > 0 ? (
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
            ) : (
              <EditField
                id="create-location-id"
                label="Opening stock location ID"
                error={errors.locationId}
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
            {single && stockHere && (
              <EditField
                id="create-stock"
                label="Opening stock"
                error={errors['variants.0.stock']}
              >
                <input
                  id="create-stock"
                  inputMode="numeric"
                  autoComplete="off"
                  value={variant.stock}
                  placeholder="0"
                  aria-invalid={errors['variants.0.stock'] ? true : undefined}
                  onChange={(event) => setVariant({ stock: event.target.value })}
                  className={`${FIELD_INPUT} text-right`}
                />
              </EditField>
            )}
          </div>
          {locations.length === 0 && (
            <p className="text-text-muted text-[0.76rem]">
              This store has no stock locations on record yet. To set a starting quantity,
              enter your Shopify location ID (in Shopify admin go to Settings → Locations;
              it is the number at the end of the page address), then a quantity for each
              variant.
            </p>
          )}
          {!single && stockHere && (
            <p className="text-text-muted text-[0.76rem]">
              Set each variant&apos;s quantity in the Variants table below.
            </p>
          )}
        </div>
      ) : (
        <p className="text-text-muted text-[0.85rem]">
          Stock is not tracked for this product, so the store won&apos;t count how many
          are left.
        </p>
      )}

      <CardFooter
        expandable={single}
        open={opened && single}
        onToggle={() => setOpen(!opened)}
        chips={
          <>
            {single && (
              <>
                <Chip
                  value={variant.sku.trim() || undefined}
                  onClick={() => setOpen(true)}
                >
                  SKU
                </Chip>
                <Chip
                  value={variant.barcode.trim() || undefined}
                  onClick={() => setOpen(true)}
                >
                  Barcode
                </Chip>
              </>
            )}
            <Chip
              pressed={keepSelling}
              value={keepSelling ? 'On' : 'Off'}
              onClick={() =>
                update({ inventoryPolicy: keepSelling ? 'DENY' : 'CONTINUE' })
              }
            >
              Sell when out of stock
            </Chip>
          </>
        }
      >
        {single && (
          <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
            <EditField
              id="create-sku"
              label="SKU"
              error={errors['variants.0.sku']}
              hint="Your own code for this product, used to find it in stock lists."
            >
              <input
                id="create-sku"
                autoComplete="off"
                value={variant.sku}
                maxLength={LIMITS.sku + 50}
                onChange={(event) => setVariant({ sku: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
            <EditField
              id="create-barcode"
              label="Barcode"
              error={errors['variants.0.barcode']}
              hint="ISBN, UPC, GTIN or similar."
            >
              <input
                id="create-barcode"
                autoComplete="off"
                value={variant.barcode}
                maxLength={LIMITS.barcode + 50}
                onChange={(event) => setVariant({ barcode: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
          </div>
        )}
      </CardFooter>
    </CreateCard>
  )
}

/**
 * **Shipping** — the "Physical product" switch (does it need shipping?) and, while it is on,
 * the weight and its unit. With options the weight is a column of the variants table, so
 * only the unit is chosen here.
 */
export function CreateShippingCard(props: CreateSectionProps) {
  const { draft, errors, update } = props
  const single = isSingleVariant(draft.variants)
  const setVariant = singleVariantSetter(props)

  return (
    <CreateCard
      title="Shipping"
      description="Whether the product is posted to the customer, and how much it weighs."
      action={
        <Switch
          label="Physical product"
          checked={draft.requiresShipping}
          onChange={(requiresShipping) => update({ requiresShipping })}
        />
      }
    >
      {draft.requiresShipping ? (
        <div className="grid grid-cols-1 items-end gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_9rem]">
          {single ? (
            <EditField
              id="create-weight"
              label="Weight"
              error={errors['variants.0.weight']}
            >
              <input
                id="create-weight"
                inputMode="decimal"
                autoComplete="off"
                value={draft.variants[0].weight}
                placeholder="0.0"
                aria-invalid={errors['variants.0.weight'] ? true : undefined}
                onChange={(event) => setVariant({ weight: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
          ) : (
            <p className="text-text-muted text-[0.85rem]">
              Each variant&apos;s weight is in the Variants table below.
            </p>
          )}
          <SelectField
            id="create-weight-unit"
            label="Weight unit"
            value={draft.weightUnit}
            options={WEIGHT_OPTIONS}
            onChange={(weightUnit) => update({ weightUnit: weightUnit as WeightUnit })}
          />
        </div>
      ) : (
        <p className="text-text-muted text-[0.85rem]">
          This product doesn&apos;t need shipping (for example a digital product or a
          service).
        </p>
      )}
    </CreateCard>
  )
}
