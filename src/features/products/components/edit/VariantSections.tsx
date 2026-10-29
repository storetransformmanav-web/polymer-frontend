import { useState } from 'react'
import { Switch } from '../../../../components/ui/Switch.tsx'
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField.tsx'
import {
  WEIGHT_UNITS,
  type ProductDetail,
  type ProductVariant,
  type WeightUnit,
} from '../../../../lib/api/endpoints.ts'
import { currencySymbol } from '../../../../lib/format.ts'
import type { StockLocationChoice } from '../../hooks/useProductStockLocations.ts'
import { LIMITS, type DraftErrors, type VariantDraft } from '../../utils/editDraft.ts'
import { formatMoney, formatPercent, profitAndMargin } from '../../utils/margin.ts'
import { CardFooter, CardSection, Chip, CreateCard } from '../create/CreateCard.tsx'
import { StockFields } from './StockFields.tsx'
import { CheckField, EditField, FIELD_INPUT, MoneyInput } from './fields.tsx'

const WEIGHT_OPTIONS = WEIGHT_UNITS.map((unit) => ({
  value: unit,
  label: unit.charAt(0) + unit.slice(1).toLowerCase(),
}))

interface VariantSectionProps {
  product: ProductDetail
  variant: VariantDraft
  /** The variant's position in the draft: its errors are `variants.<index>.<field>`. */
  index: number
  errors: DraftErrors
  update: (patch: Partial<VariantDraft>) => void
  /** Prefix for element ids, unique per variant. */
  prefix: string
}

/**
 * **Price** of one variant, laid out like the Price card of Add product: the price in a box
 * with the store's currency symbol in front, and under it a footer of pills — Compare-at ·
 * Charge tax · Cost per item — and a chevron that opens the extra fields (compare-at price, cost
 * per item with the profit and margin worked out from it, the tax code and whether tax is
 * charged). A pill opens the footer and puts the cursor in its own field. A problem inside a
 * closed footer opens it.
 */
export function VariantPriceCard({
  product,
  variant,
  index,
  errors,
  update,
  prefix,
}: VariantSectionProps) {
  const [open, setOpen] = useState(false)
  const at = (field: string) => errors[`variants.${index}.${field}`]
  const symbol = currencySymbol(product.currency ?? null)
  const opened = open || Boolean(at('compareAtPrice') || at('cost') || at('taxCode'))
  const { profit, margin } = profitAndMargin(variant.price, variant.cost)

  function openAt(id: string | null) {
    setOpen(true)
    if (id) window.requestAnimationFrame(() => document.getElementById(id)?.focus())
  }

  return (
    <CreateCard title="Price" regionLabel={`Pricing of ${variant.title}`} headingAbove>
      <div className="max-w-xs">
        <label htmlFor={`${prefix}-price`} className="sr-only">
          {`Price${product.currency ? ` (${product.currency})` : ''}`}
        </label>
        <MoneyInput
          id={`${prefix}-price`}
          symbol={symbol}
          value={variant.price}
          invalid={Boolean(at('price'))}
          onChange={(price) => update({ price })}
        />
        {at('price') && (
          <p role="alert" className="text-danger mt-1 text-[0.78rem]">
            {at('price')}
          </p>
        )}
      </div>

      <CardFooter
        open={opened}
        onToggle={() => setOpen(!opened)}
        chips={
          <>
            <Chip
              value={variant.compareAtPrice.trim() || undefined}
              onClick={() => openAt(`${prefix}-compare`)}
            >
              Compare-at
            </Chip>
            <Chip value={variant.taxable ? 'Yes' : 'No'} onClick={() => openAt(null)}>
              Charge tax
            </Chip>
            <Chip
              value={variant.cost.trim() || undefined}
              onClick={() => openAt(`${prefix}-cost`)}
            >
              Cost per item
            </Chip>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
          <EditField
            id={`${prefix}-compare`}
            label="Compare-at price"
            error={at('compareAtPrice')}
            hint="The original price, shown crossed out next to the price (for a sale)."
          >
            <MoneyInput
              id={`${prefix}-compare`}
              symbol={symbol}
              value={variant.compareAtPrice}
              invalid={Boolean(at('compareAtPrice'))}
              onChange={(compareAtPrice) => update({ compareAtPrice })}
            />
          </EditField>
          <EditField
            id={`${prefix}-cost`}
            label="Cost per item"
            error={at('cost')}
            hint={
              profit === null
                ? 'What it costs you. Customers never see this.'
                : `Profit ${formatMoney(profit, product.currency ?? null)} · Margin ${formatPercent(margin)}. Customers never see the cost.`
            }
          >
            <MoneyInput
              id={`${prefix}-cost`}
              symbol={symbol}
              value={variant.cost}
              invalid={Boolean(at('cost'))}
              onChange={(cost) => update({ cost })}
            />
          </EditField>
          <EditField
            id={`${prefix}-taxcode`}
            label="Tax code"
            optional
            error={at('taxCode')}
            hint="Leave blank to keep the current code."
            counter={{ value: variant.taxCode.trim().length, max: LIMITS.taxCode }}
          >
            <input
              id={`${prefix}-taxcode`}
              autoComplete="off"
              value={variant.taxCode}
              aria-invalid={at('taxCode') ? true : undefined}
              onChange={(event) => update({ taxCode: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
        </div>
        <CheckField
          label="Charge tax"
          hint="Tax is added at checkout using your store's tax settings."
          checked={variant.taxable}
          onChange={(taxable) => update({ taxable })}
        />
      </CardFooter>
    </CreateCard>
  )
}

/**
 * **Inventory** of one variant, like the store admin's Inventory card and Add product's: the
 * "Inventory tracked" switch; while it is on, a Locations table (Unavailable · Committed ·
 * Available · On hand — the Available quantity is the one that is edited, On hand follows it); and a
 * collapsible **More details** section: SKU, barcode and whether to keep selling at zero.
 */
export function VariantInventoryCard({
  product,
  variant,
  index,
  errors,
  update,
  prefix,
  locations,
}: VariantSectionProps & { locations: StockLocationChoice[] }) {
  const [open, setOpen] = useState(true)
  const at = (field: string) => errors[`variants.${index}.${field}`]
  const levels: ProductVariant['inventory_levels'] =
    product.variants.find((candidate) => candidate.id === variant.id)?.inventory_levels ??
    []
  const opened = open || Boolean(at('sku') || at('barcode'))

  return (
    <CreateCard
      title="Inventory"
      regionLabel={`Inventory of ${variant.title}`}
      action={
        <Switch
          label="Inventory tracked"
          checked={variant.tracked}
          onChange={(tracked) => update({ tracked })}
        />
      }
    >
      {variant.tracked ? (
        <StockFields
          rows={variant.stock}
          onChange={(stock) => update({ stock })}
          locations={locations}
          errors={errors}
          prefix={`variants.${index}.stock`}
          label={`Stock of ${variant.title}`}
          levels={levels}
        />
      ) : (
        <p className="text-text-muted text-[0.85rem]">
          Stock is not tracked for this variant, so the store won&apos;t count how many
          are left.
        </p>
      )}

      <CardSection
        title="More details"
        open={opened}
        onToggle={() => setOpen(!opened)}
        last
      >
        <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
          <EditField
            id={`${prefix}-sku`}
            label="SKU (Stock Keeping Unit)"
            error={at('sku')}
            counter={{ value: variant.sku.trim().length, max: LIMITS.sku }}
          >
            <input
              id={`${prefix}-sku`}
              autoComplete="off"
              value={variant.sku}
              aria-invalid={at('sku') ? true : undefined}
              onChange={(event) => update({ sku: event.target.value })}
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
              aria-invalid={at('barcode') ? true : undefined}
              onChange={(event) => update({ barcode: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
        </div>
        <CheckField
          label="Continue selling when out of stock"
          hint="Customers can keep buying after the stock runs out."
          checked={variant.inventoryPolicy === 'CONTINUE'}
          onChange={(keep) => update({ inventoryPolicy: keep ? 'CONTINUE' : 'DENY' })}
        />
      </CardSection>
    </CreateCard>
  )
}

/**
 * **Shipping** of one variant, like Add product's: the "Physical product" switch (does it need
 * shipping?) and, while it is on, the weight and its unit.
 */
export function VariantShippingCard({
  variant,
  index,
  errors,
  update,
  prefix,
}: VariantSectionProps) {
  const at = (field: string) => errors[`variants.${index}.${field}`]

  return (
    <CreateCard
      title="Shipping"
      regionLabel={`Shipping of ${variant.title}`}
      action={
        <Switch
          label="Physical product"
          checked={variant.requiresShipping}
          onChange={(requiresShipping) => update({ requiresShipping })}
        />
      }
    >
      {variant.requiresShipping ? (
        <div className="grid grid-cols-1 items-end gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_9rem]">
          <EditField id={`${prefix}-weight`} label="Weight" optional error={at('weight')}>
            <input
              id={`${prefix}-weight`}
              inputMode="decimal"
              autoComplete="off"
              value={variant.weight}
              placeholder="0.0"
              aria-invalid={at('weight') ? true : undefined}
              onChange={(event) => update({ weight: event.target.value })}
              className={FIELD_INPUT}
            />
          </EditField>
          <SelectField
            id={`${prefix}-unit`}
            label="Weight unit"
            value={variant.weightUnit}
            options={WEIGHT_OPTIONS}
            onChange={(unit) => update({ weightUnit: unit as WeightUnit })}
          />
        </div>
      ) : (
        <p className="text-text-muted text-[0.85rem]">
          This variant doesn&apos;t need shipping (for example a digital product or a
          service).
        </p>
      )}
    </CreateCard>
  )
}

/** Which of the product's pictures this variant shows (another one, or none). */
export function VariantImageCard({
  variant,
  prefix,
  options,
  value,
  onChange,
}: {
  variant: VariantDraft
  prefix: string
  options: SelectOption[]
  value: string
  onChange: (choice: string) => void
}) {
  return (
    <CreateCard title="Image" regionLabel={`Picture of ${variant.title}`}>
      <SelectField
        hideLabel
        id={`${prefix}-image`}
        label="Image"
        value={value}
        options={options}
        onChange={onChange}
      />
    </CreateCard>
  )
}
