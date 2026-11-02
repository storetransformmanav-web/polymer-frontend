import { useState } from 'react'
import { Switch } from '../../../../components/ui/Switch.tsx'
import { SelectField } from '../../../../components/ui/SelectField.tsx'
import { type StockLocation } from '../../../../lib/api/endpoints.ts'
import { currencySymbol } from '../../../../lib/format.ts'
import { CREATE_LIMITS, type CreateVariantDraft } from '../../utils/createDraft.ts'
import { LIMITS } from '../../utils/editDraft.ts'
import { formatMoney, formatPercent, profitAndMargin } from '../../utils/margin.ts'
import { CheckField, EditField, FIELD_INPUT, MoneyInput } from '../edit/fields.tsx'
import { ShippingFields } from '../edit/ShippingFields.tsx'
import {
  CardFooter,
  CardSection,
  Chip,
  CreateCard,
  type CreateSectionProps,
} from './CreateCard.tsx'

/** A product without options has exactly one variant, edited as plain fields. */
export const isSingleVariant = (variants: CreateVariantDraft[]) =>
  variants.length === 1 && variants[0].optionValues.length === 0

/** Sets one field of the only variant. */
function singleVariantSetter({ draft, update }: CreateSectionProps) {
  return (patch: Partial<CreateVariantDraft>) =>
    update({ variants: draft.variants.map((variant) => ({ ...variant, ...patch })) })
}

/** The location / quantity grid of the Inventory card (the quantity column is narrower on phones). */
const STOCK_GRID =
  'grid grid-cols-[minmax(0,1fr)_7rem] gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]'

/**
 * **Price** — the price of a product without options (with options every variant is priced in
 * the Variants table) and, under it, a footer of pill buttons — Compare-at · Charge tax · Cost
 * per item — and a chevron. The footer's fields (compare-at price, cost per item with the
 * profit and margin worked out from it, whether tax is charged and the tax code) stay closed
 * until a pill or the chevron is pressed; a pill also moves the cursor to its own field.
 */
export function CreatePriceCard(props: CreateSectionProps & { currency: string | null }) {
  const { draft, errors, update, currency } = props
  const [open, setOpen] = useState(false)
  const single = isSingleVariant(draft.variants)
  const setVariant = singleVariantSetter(props)
  const variant = draft.variants[0]
  const symbol = currencySymbol(currency)
  // A problem in a closed section opens it: it can't be fixed from out of sight.
  const opened =
    open ||
    Boolean(
      errors['variants.0.compareAtPrice'] || errors['variants.0.cost'] || errors.taxCode,
    )
  const { profit, margin } = profitAndMargin(variant.price, variant.cost)

  // A pill opens the section, then the cursor goes to the field it stands for (once it is drawn).
  function openAt(id: string | null) {
    setOpen(true)
    if (id) window.requestAnimationFrame(() => document.getElementById(id)?.focus())
  }

  return (
    <CreateCard title="Price" regionLabel="Pricing" headingAbove>
      {single ? (
        <div className="max-w-xs">
          <label htmlFor="create-price" className="sr-only">
            Price
          </label>
          <MoneyInput
            id="create-price"
            symbol={symbol}
            value={variant.price}
            invalid={Boolean(errors['variants.0.price'])}
            onChange={(price) => setVariant({ price })}
          />
          {errors['variants.0.price'] && (
            <p role="alert" className="text-danger mt-1 text-[0.78rem]">
              {errors['variants.0.price']}
            </p>
          )}
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
                onClick={() => openAt('create-compare')}
              >
                Compare-at
              </Chip>
            )}
            {!opened && (
              <Chip
                value={draft.taxable ? 'Yes' : 'No'}
                onClick={() => openAt('create-taxable')}
              >
                Charge tax
              </Chip>
            )}
            {single && (
              <Chip
                value={variant.cost.trim() || undefined}
                onClick={() => openAt('create-cost')}
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
                <MoneyInput
                  id="create-compare"
                  symbol={symbol}
                  value={variant.compareAtPrice}
                  invalid={Boolean(errors['variants.0.compareAtPrice'])}
                  onChange={(compareAtPrice) => setVariant({ compareAtPrice })}
                />
              </EditField>
              <EditField
                id="create-cost"
                label="Cost per item"
                error={errors['variants.0.cost']}
                hint={
                  profit === null
                    ? 'What it costs you. Customers never see this.'
                    : `Profit ${formatMoney(profit, currency)} · Margin ${formatPercent(margin)}. Customers never see the cost.`
                }
              >
                <MoneyInput
                  id="create-cost"
                  symbol={symbol}
                  value={variant.cost}
                  invalid={Boolean(errors['variants.0.cost'])}
                  onChange={(cost) => setVariant({ cost })}
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
          id="create-taxable"
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
 * **Inventory** — the "Inventory tracked" switch; while it is on, a Location / Quantity table
 * for the opening stock (the location is a dropdown of the store's locations, or the Shopify
 * location number when none is on record; the quantity is for a product without options, or
 * per variant in the Variants table), and a collapsible **More details** section: SKU, barcode
 * (with options they are columns of the variants table) and whether to keep selling at zero.
 */
export function CreateInventoryCard(
  props: CreateSectionProps & {
    /** The store's stock locations (empty when none are known). */
    locations: StockLocation[]
  },
) {
  const { draft, errors, update, locations } = props
  const [open, setOpen] = useState(true)
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
      action={
        <Switch label="Inventory tracked" checked={draft.tracked} onChange={setTracked} />
      }
    >
      {draft.tracked ? (
        <div className="flex flex-col gap-2">
          <div className="border-border overflow-hidden rounded-xl border">
            <div
              className={`${STOCK_GRID} bg-surface text-text-muted px-3 py-2 text-[0.76rem] font-semibold`}
            >
              <span>Location</span>
              <span className="text-right">Quantity</span>
            </div>
            <div className={`${STOCK_GRID} items-center p-3`}>
              {locations.length > 0 ? (
                <SelectField
                  hideLabel
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
                <>
                  <label htmlFor="create-location-id" className="sr-only">
                    Opening stock location ID
                  </label>
                  <input
                    id="create-location-id"
                    inputMode="numeric"
                    autoComplete="off"
                    value={draft.locationId}
                    placeholder="Shopify location ID, e.g. 72843812"
                    aria-invalid={errors.locationId ? true : undefined}
                    onChange={(event) =>
                      // Digits only: it is a Shopify location number.
                      update({ locationId: event.target.value.replace(/\D/g, '') })
                    }
                    className={FIELD_INPUT}
                  />
                </>
              )}
              {single && stockHere ? (
                <>
                  <label htmlFor="create-stock" className="sr-only">
                    Opening stock
                  </label>
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
                </>
              ) : (
                <span className="text-text-muted text-right text-[0.8rem]">
                  {single ? '—' : 'Per variant'}
                </span>
              )}
            </div>
          </div>
          {errors.locationId && (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors.locationId}
            </p>
          )}
          {errors['variants.0.stock'] && (
            <p role="alert" className="text-danger text-[0.78rem]">
              {errors['variants.0.stock']}
            </p>
          )}
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

      <CardSection
        title="More details"
        open={opened}
        onToggle={() => setOpen(!opened)}
        last
      >
        {single && (
          <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
            <EditField
              id="create-sku"
              label="SKU (Stock Keeping Unit)"
              error={errors['variants.0.sku']}
              hint="Your own code for this product, used to find it in stock lists."
            >
              <input
                id="create-sku"
                autoComplete="off"
                value={variant.sku}
                maxLength={LIMITS.sku + 50}
                aria-invalid={errors['variants.0.sku'] ? true : undefined}
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
                aria-invalid={errors['variants.0.barcode'] ? true : undefined}
                onChange={(event) => setVariant({ barcode: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
          </div>
        )}
        <CheckField
          label="Continue selling when out of stock"
          hint="Customers can keep buying after the stock runs out."
          checked={keepSelling}
          onChange={(keep) => update({ inventoryPolicy: keep ? 'CONTINUE' : 'DENY' })}
        />
      </CardSection>
    </CreateCard>
  )
}

/**
 * **Shipping** — the "Physical product" switch (does it need shipping?) and, while it is on,
 * the package, the packed size, the weight and its unit, the country of origin and the HS code
 * (`ShippingFields`). With options the weight is a column of the variants table, so only the
 * unit is chosen here; the size, country and code are the same for every variant.
 */
export function CreateShippingCard(props: CreateSectionProps) {
  const { draft, errors, update } = props
  const single = isSingleVariant(draft.variants)
  const setVariant = singleVariantSetter(props)

  return (
    <CreateCard
      title="Shipping"
      action={
        <Switch
          label="Physical product"
          checked={draft.requiresShipping}
          onChange={(requiresShipping) => update({ requiresShipping })}
        />
      }
    >
      {draft.requiresShipping ? (
        <ShippingFields
          idPrefix="create"
          shipping={draft.shipping}
          onShipping={(patch) => update({ shipping: { ...draft.shipping, ...patch } })}
          problems={{
            dimensions: errors['shipping.dimensions'],
            countryCode: errors['shipping.countryCode'],
            hsCode: errors['shipping.hsCode'],
          }}
          weight={
            single
              ? {
                  value: draft.variants[0].weight,
                  onChange: (weight) => setVariant({ weight }),
                  error: errors['variants.0.weight'],
                }
              : null
          }
          weightNote="Each variant's weight is in the Variants table below."
          weightUnit={draft.weightUnit}
          onWeightUnit={(weightUnit) => update({ weightUnit })}
        />
      ) : (
        <p className="text-text-muted text-[0.85rem]">
          This product doesn&apos;t need shipping (for example a digital product or a
          service).
        </p>
      )}
    </CreateCard>
  )
}
