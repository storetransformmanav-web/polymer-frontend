import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  DETAIL_CARD,
  DETAIL_TD,
  DETAIL_TH,
  DetailEmpty,
  DetailSection,
  Field,
} from '../../../components/ui/DetailSection.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  BoxesIcon,
  CalendarIcon,
  CreditCardIcon,
  GlobeIcon,
  LayersIcon,
  PoundIcon,
  ProductsIcon,
  ShoppingCartIcon,
  TruckIcon,
} from '../../../components/ui/icons.tsx'
import { safeUrl } from '../../../lib/safeUrl.ts'
import type {
  SageStockDetail,
  SageStockShopifyVariant,
} from '../../../lib/api/sageStock.ts'
import {
  count,
  dateText,
  fieldLabel,
  looseValue,
  money,
  monthText,
  percent,
  yesNo,
} from '../utils/format.ts'

const NUMBER_TD = `${DETAIL_TD} text-right tabular-nums`
// The shared heading style has its own `text-left`; each heading sets its alignment alone.
const TH = DETAIL_TH.replace('text-left', '')
const TH_LEFT = `${TH} text-left`
const TH_RIGHT = `${TH} text-right`

const LINK = 'text-text hover:text-accent font-semibold no-underline hover:underline'

/** Label-over-value fields, tightly spaced. */
const FIELDS = 'm-0 grid grid-cols-1 gap-x-5 gap-y-3 min-[520px]:grid-cols-2'

const copyable = (value: string, label: string) =>
  value ? (
    <span className="flex items-center gap-1.5">
      <span className="break-all">{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  ) : null

/** A table card that scrolls sideways when the window is narrower than it. */
function TableCard({ minWidth, children }: { minWidth: string; children: ReactNode }) {
  return (
    <div className={`${DETAIL_CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className={`w-full ${minWidth} border-collapse`}>{children}</table>
      </div>
    </div>
  )
}

/**
 * A list of free-form records the API describes no fields for (discount bands, open order lines): one
 * column for every field any of them has, headings and values written for people.
 */
function LooseTable({ rows }: { rows: Record<string, unknown>[] }) {
  const keys: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key)
  }
  return (
    <TableCard minWidth="min-w-[640px]">
      <thead>
        <tr>
          {keys.map((key) => (
            <th key={key} className={TH_LEFT}>
              {fieldLabel(key)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={index}
            className="border-border even:bg-surface/60 border-b last:border-b-0"
          >
            {keys.map((key) => (
              <td key={key} className={DETAIL_TD}>
                {looseValue(key, row[key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableCard>
  )
}

// ---------------------------------------------------------------------------- Overview

/**
 * The Overview tab — the item at a glance on one compact screen: its **Stock Levels**, the **Item
 * Information**, the **Supplier & Accounts** details and the **Key Dates**. Prices, sales and the web
 * details have their own tabs.
 */
export function OverviewPanel({ detail }: { detail: SageStockDetail }) {
  const s = detail.stock
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DetailSection compact title="Stock Levels" icon={BoxesIcon}>
        <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 xl:grid-cols-7">
          <Field label="In stock">{count(s?.in_stock)}</Field>
          <Field label="Allocated">{count(s?.allocated)}</Field>
          <Field label="Free">{count(s?.free)}</Field>
          <Field label="On order">{count(s?.on_order)}</Field>
          <Field label="Reorder level">{count(detail.reorder_level)}</Field>
          <Field label="Reorder quantity">{count(detail.reorder_qty)}</Field>
          <Field label="Stock value">{money(detail.stock_value)}</Field>
        </dl>
      </DetailSection>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DetailSection compact title="Item Information" icon={LayersIcon}>
          <dl className={`${FIELDS} xl:grid-cols-3`}>
            <Field label="Description">{detail.description}</Field>
            <Field label="Category">
              {[
                detail.category,
                detail.category_number && `No. ${detail.category_number}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Field>
            <Field label="Department">{detail.department}</Field>
            <Field label="Unit of sale">{detail.unit_of_sale}</Field>
            <Field label="Unit weight">
              {detail.unit_weight === null
                ? ''
                : detail.unit_weight.toLocaleString('en-GB')}
            </Field>
            <Field label="Barcode">{copyable(detail.barcode, 'Copy barcode')}</Field>
            <Field label="Location">{detail.location}</Field>
            <Field label="Commodity code">{detail.commodity_code}</Field>
            <Field label="Country of origin">{detail.country_of_origin}</Field>
          </dl>
        </DetailSection>

        <DetailSection compact title="Supplier & Accounts" icon={TruckIcon}>
          <dl className={FIELDS}>
            <Field label="Supplier account">
              {copyable(detail.supplier_ref, 'Copy supplier account')}
            </Field>
            <Field label="Supplier part number">{detail.supplier_part_number}</Field>
            <Field label="Sales nominal code">{detail.nominal_code}</Field>
            <Field label="Purchase nominal code">{detail.purchase_nominal_code}</Field>
            <Field label="Tax code">{detail.tax_code}</Field>
          </dl>
        </DetailSection>
      </div>

      <DetailSection compact title="Key Dates" icon={CalendarIcon}>
        <dl className="m-0 grid grid-cols-1 gap-x-5 gap-y-3 min-[520px]:grid-cols-2 xl:grid-cols-4">
          <Field label="Last sold">
            {detail.last_sale_date ? dateText(detail.last_sale_date) : ''}
          </Field>
          <Field label="Last purchased">
            {detail.last_purchase_date ? dateText(detail.last_purchase_date) : ''}
          </Field>
          <Field label="Last stock take">
            {detail.last_stock_take_date ? dateText(detail.last_stock_take_date) : ''}
          </Field>
          <Field label="Quantity at last stock take">
            {count(detail.qty_last_stock_take)}
          </Field>
        </dl>
      </DetailSection>
    </div>
  )
}

// ---------------------------------------------------------------------------- Pricing

/** The Pricing tab: the item's prices, its price lists and its discount bands. */
export function PricingPanel({ detail }: { detail: SageStockDetail }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DetailSection compact title="Prices" icon={PoundIcon}>
        <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-4">
          <Field label="Sales price">{money(detail.sales_price)}</Field>
          <Field label="Average cost">{money(detail.average_cost)}</Field>
          <Field label="Last purchase price">{money(detail.last_purchase_price)}</Field>
          <Field label="Margin">{percent(detail.margin_percent)}</Field>
        </dl>
      </DetailSection>

      <DetailSection
        compact
        flush
        title="Price Lists"
        icon={CreditCardIcon}
        count={detail.price_lists.length}
      >
        {detail.price_lists.length === 0 ? (
          <p className="text-text-muted m-0 p-3 text-[0.85rem] sm:p-4">
            This item is on no price list.
          </p>
        ) : (
          <TableCard minWidth="min-w-[720px]">
            <thead>
              <tr>
                <th className={TH_LEFT}>Pricing reference</th>
                <th className={TH_LEFT}>Name</th>
                <th className={`${TH} text-center`}>Currency</th>
                <th className={TH_LEFT}>Calculation method</th>
                <th className={TH_RIGHT}>Calculation value</th>
                <th className={TH_RIGHT}>Price</th>
                <th className={TH_RIGHT}>Customers</th>
              </tr>
            </thead>
            <tbody>
              {detail.price_lists.map((list, index) => (
                <tr
                  key={`${list.pricing_ref}-${index}`}
                  className="border-border even:bg-surface/60 border-b last:border-b-0"
                >
                  <td className={`${DETAIL_TD} font-semibold`}>
                    {list.pricing_ref || '—'}
                  </td>
                  <td className={DETAIL_TD}>{list.name || '—'}</td>
                  <td className={`${DETAIL_TD} text-center`}>{list.currency || '—'}</td>
                  <td className={DETAIL_TD}>{list.calculation_method || '—'}</td>
                  <td className={NUMBER_TD}>
                    {list.calculation_value === null
                      ? '—'
                      : list.calculation_value.toLocaleString('en-GB')}
                  </td>
                  <td className={`${NUMBER_TD} font-semibold`}>
                    {money(list.price, list.currency)}
                  </td>
                  <td className={NUMBER_TD}>{count(list.customers)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </DetailSection>

      <DetailSection
        compact
        flush={detail.discount_bands.length > 0}
        title="Discount Bands"
        icon={LayersIcon}
        count={detail.discount_bands.length}
      >
        {detail.discount_bands.length === 0 ? (
          <p className="text-text-muted m-0 text-[0.85rem]">
            This item has no discount bands.
          </p>
        ) : (
          <LooseTable rows={detail.discount_bands} />
        )}
      </DetailSection>
    </div>
  )
}

// ---------------------------------------------------------------------------- Sales

/** The Sales tab: the year to date, then each month of the financial year beside the same month a year earlier. */
export function SalesPanel({ detail }: { detail: SageStockDetail }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DetailSection compact title="Year to Date" icon={PoundIcon}>
        <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-4">
          <Field label="Quantity sold">{count(detail.qty_sold_ytd)}</Field>
          <Field label="Sales">{money(detail.sales_ytd)}</Field>
          <Field label="Cost">{money(detail.cost_ytd)}</Field>
          <Field label="Financial year start">
            {detail.financial_year_start ? dateText(detail.financial_year_start) : ''}
          </Field>
        </dl>
      </DetailSection>

      <DetailSection
        compact
        flush={detail.months.length > 0}
        title="Monthly Sales"
        icon={CalendarIcon}
        count={detail.months.length}
      >
        {detail.months.length === 0 ? (
          <p className="text-text-muted m-0 text-[0.85rem]">No monthly figures.</p>
        ) : (
          <TableCard minWidth="min-w-[860px]">
            <thead>
              <tr>
                <th className={TH_LEFT}>Month</th>
                <th className={`${TH} text-center`}>Period</th>
                <th className={TH_RIGHT}>Qty sold</th>
                <th className={TH_RIGHT}>Sales</th>
                <th className={TH_RIGHT}>Cost</th>
                <th className={`${TH_RIGHT} border-border-strong border-l`}>
                  Prior year qty
                </th>
                <th className={TH_RIGHT}>Prior year sales</th>
                <th className={TH_RIGHT}>Prior year cost</th>
              </tr>
            </thead>
            <tbody>
              {detail.months.map((month, index) => (
                <tr
                  key={`${month.month}-${index}`}
                  className="border-border even:bg-surface/60 border-b last:border-b-0"
                >
                  <td className={`${DETAIL_TD} font-semibold`}>
                    {monthText(month.month)}
                  </td>
                  <td className={`${DETAIL_TD} text-center`}>{month.period ?? '—'}</td>
                  <td className={NUMBER_TD}>{count(month.qty_sold)}</td>
                  <td className={NUMBER_TD}>{money(month.sales)}</td>
                  <td className={NUMBER_TD}>{money(month.cost)}</td>
                  <td className={`${NUMBER_TD} border-border-strong border-l`}>
                    {count(month.prior_year_qty_sold)}
                  </td>
                  <td className={NUMBER_TD}>{money(month.prior_year_sales)}</td>
                  <td className={NUMBER_TD}>{money(month.prior_year_cost)}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </DetailSection>
    </div>
  )
}

// ---------------------------------------------------------------------------- Web & Shopify

/** A linked variant's picture, small, from an https address only. */
function Thumb({ url }: { url: string }) {
  const src = safeUrl(url)
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="bg-surface border-border text-text-muted flex size-8 shrink-0 items-center justify-center rounded border"
      >
        <ProductsIcon width={14} height={14} />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="border-border size-8 shrink-0 rounded border object-cover"
    />
  )
}

function VariantRow({ variant }: { variant: SageStockShopifyVariant }) {
  const title = variant.title || variant.sku
  return (
    <tr className="border-border even:bg-surface/60 border-b last:border-b-0">
      <td className={`${DETAIL_TD} !whitespace-normal`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Thumb url={variant.image_url} />
          {variant.product_id ? (
            <Link
              to={`/products/${encodeURIComponent(variant.product_id)}`}
              className={`${LINK} break-words`}
            >
              {title}
            </Link>
          ) : (
            <span className="font-medium break-words">{title}</span>
          )}
        </div>
      </td>
      <td className={DETAIL_TD}>{variant.variant_title || '—'}</td>
      <td className={DETAIL_TD}>{variant.sku || '—'}</td>
      <td className={NUMBER_TD}>{money(variant.price)}</td>
      <td className={NUMBER_TD}>{count(variant.inventory_quantity)}</td>
    </tr>
  )
}

/** The Web & Shopify tab: how the item is published on the web and the CRM / Shopify variants that have its SKU. */
export function WebPanel({ detail }: { detail: SageStockDetail }) {
  const web = detail.web
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DetailSection compact title="Web" icon={GlobeIcon}>
        {web ? (
          <dl className={`${FIELDS} xl:grid-cols-3`}>
            <Field label="Published">{yesNo(web.published)}</Field>
            <Field label="Special offer">{yesNo(web.special_offer)}</Field>
            <Field label="Web description">{web.description}</Field>
            <Field label="Category 1">{web.category_1}</Field>
            <Field label="Category 2">{web.category_2}</Field>
            <Field label="Category 3">{web.category_3}</Field>
            <div className="min-w-0 min-[520px]:col-span-2 xl:col-span-3">
              <Field label="Web details">{web.details}</Field>
            </div>
          </dl>
        ) : (
          <p className="text-text-muted m-0 text-[0.85rem]">No web details.</p>
        )}
      </DetailSection>

      <DetailSection
        compact
        flush={detail.shopify.length > 0}
        title="Shopify Variants"
        icon={ProductsIcon}
        count={detail.shopify.length}
      >
        {detail.shopify.length === 0 ? (
          <p className="text-text-muted m-0 text-[0.85rem]">
            No CRM product has this SKU: it is in Sage only.
          </p>
        ) : (
          <TableCard minWidth="min-w-[720px]">
            <thead>
              <tr>
                <th className={TH_LEFT}>Product</th>
                <th className={TH_LEFT}>Variant</th>
                <th className={TH_LEFT}>SKU</th>
                <th className={TH_RIGHT}>Price</th>
                <th className={TH_RIGHT}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {detail.shopify.map((variant, index) => (
                <VariantRow key={`${variant.variant_id}-${index}`} variant={variant} />
              ))}
            </tbody>
          </TableCard>
        )}
      </DetailSection>
    </div>
  )
}

// ---------------------------------------------------------------------------- Open orders

/** The Open Orders tab: the open sales order lines the API lists for the item. */
export function OpenOrdersPanel({ detail }: { detail: SageStockDetail }) {
  if (detail.open_order_lines.length === 0) {
    return (
      <DetailEmpty icon={ShoppingCartIcon}>
        This item has no open order lines.
      </DetailEmpty>
    )
  }
  return <LooseTable rows={detail.open_order_lines} />
}
