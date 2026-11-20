import type { ComponentType, ReactNode } from 'react'
import { DetailSection } from '../../../components/ui/DetailSection.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  BoxesIcon,
  CheckCircleIcon,
  CalendarIcon,
  FileTextIcon,
  LayersIcon,
  PoundIcon,
  RefreshIcon,
  ShoppingCartIcon,
  TruckIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import type { SageStockDetail } from '../../../lib/api/sageStock.ts'
import { count, dateText, money } from '../utils/format.ts'

const copyable = (value: string, label: string) =>
  value ? (
    <span className="flex items-center gap-1.5">
      <span className="break-all">{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  ) : null

// ---------------------------------------------------------------------------- Overview

const TILE_TONES = {
  accent: 'bg-accent-tint text-accent',
  info: 'bg-info-bg text-info',
  violet: 'bg-violet-bg text-violet',
  neutral: 'bg-surface text-text-muted',
}

/** A headline figure: a tinted icon tile, the label and the value in bold. */
export function MetricTile({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
  small = false,
}: {
  icon: ComponentType<IconProps>
  label: string
  value: ReactNode
  tone?: keyof typeof TILE_TONES
  small?: boolean
}) {
  return (
    <div
      className={`border-border bg-surface/60 flex min-w-0 items-center rounded-xl border ${
        small ? 'gap-2.5 px-3 py-2' : 'gap-3 px-3 py-2.5'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-lg ${TILE_TONES[tone]} ${
          small ? 'size-8' : 'size-9'
        }`}
      >
        <Icon width={small ? 16 : 20} height={small ? 16 : 20} />
      </span>
      <div className="min-w-0">
        <p className="text-text-muted m-0 truncate text-[0.78rem] font-medium">{label}</p>
        <p className="m-0 truncate text-[1.05rem] leading-tight font-bold tabular-nums">
          {value}
        </p>
      </div>
    </div>
  )
}

/** One labelled value of a card: the label muted, the value in bold, a dash when there is none. */
export function Item({
  label,
  children,
  note,
}: {
  label: string
  children: ReactNode
  /** A small line under the value ("No. 7"). */
  note?: string
}) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className="min-w-0">
      <dt className="text-text-muted mb-0.5 text-[0.8rem] font-medium">{label}</dt>
      <dd className="m-0 text-[0.95rem] font-semibold break-words">
        {empty ? <span className="text-text-muted font-normal">—</span> : children}
      </dd>
      {note && <p className="text-text-muted m-0 mt-0.5 text-[0.78rem]">{note}</p>}
    </div>
  )
}

/** Items laid out in rows of `columns`, each row divided from the next by a thin line. */
function ItemRows({ rows, columns }: { rows: ReactNode[][]; columns: 2 | 3 }) {
  return (
    <dl className="m-0 flex flex-col">
      {rows.map((row, index) => (
        <div
          key={index}
          className={`border-border grid grid-cols-1 gap-x-6 gap-y-2.5 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0 min-[520px]:grid-cols-2 ${
            columns === 3 ? 'lg:grid-cols-3' : ''
          }`}
        >
          {row}
        </div>
      ))}
    </dl>
  )
}

/** Yes / No as a small pill (Yes stands out); a dash when the API says nothing. */
function FlagPill({ value }: { value: boolean | null }) {
  if (value === null) return null
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-0.5 text-[0.82rem] font-semibold ${
        value ? 'bg-warning-bg text-warning' : 'bg-surface text-text'
      }`}
    >
      {value ? 'Yes' : 'No'}
    </span>
  )
}

/** A date or a quantity of the Key Dates card: a small icon and the label, the value under it. */
export function DateCell({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<IconProps>
  label: string
  children: ReactNode
}) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className="border-border min-w-0 px-4 first:pl-0 last:pr-0 xl:border-l xl:first:border-l-0">
      <dt className="text-text-muted flex items-center gap-1.5 text-[0.8rem] font-medium">
        <Icon width={14} height={14} className="shrink-0" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="m-0 mt-1 text-[0.95rem] font-semibold">
        {empty ? <span className="text-text-muted font-normal">—</span> : children}
      </dd>
    </div>
  )
}

/**
 * The Overview tab, after the reference design: **Stock Summary** (six figure tiles — in stock,
 * allocated, free, on order, then the reorder level and quantity after a divider), **Item Information**
 * beside **Supplier & Account Details**, and **Key Dates** beside **Year to Date**. Prices, the monthly
 * sales and the web details have their own tabs. Everything shown is the details answer's.
 */
export function OverviewPanel({ detail }: { detail: SageStockDetail }) {
  const s = detail.stock
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <DetailSection compact title="Stock Summary" icon={LayersIcon}>
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto_repeat(2,minmax(0,1fr))]">
          <MetricTile
            icon={BoxesIcon}
            label="In Stock"
            value={count(s?.in_stock)}
            tone="accent"
          />
          <MetricTile
            icon={LayersIcon}
            label="Allocated"
            value={count(s?.allocated)}
            tone="info"
          />
          <MetricTile
            icon={CheckCircleIcon}
            label="Free"
            value={count(s?.free)}
            tone="accent"
          />
          <MetricTile
            icon={ShoppingCartIcon}
            label="On Order"
            value={count(s?.on_order)}
            tone="violet"
          />
          <span aria-hidden="true" className="bg-border hidden w-px xl:block" />
          <MetricTile
            icon={RefreshIcon}
            label="Reorder Level"
            value={count(detail.reorder_level)}
          />
          <MetricTile
            icon={BoxesIcon}
            label="Reorder Qty"
            value={count(detail.reorder_qty)}
          />
        </div>
      </DetailSection>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DetailSection compact title="Item Information" icon={FileTextIcon}>
          <ItemRows
            columns={3}
            rows={[
              [
                <Item key="description" label="Description">
                  {detail.description}
                </Item>,
                <Item
                  key="category"
                  label="Category"
                  note={
                    detail.category_number ? `No. ${detail.category_number}` : undefined
                  }
                >
                  {detail.category}
                </Item>,
                <Item key="department" label="Department">
                  {detail.department}
                </Item>,
              ],
              [
                <Item key="unit" label="Unit of Sale">
                  {detail.unit_of_sale}
                </Item>,
                <Item key="weight" label="Unit Weight">
                  {detail.unit_weight === null
                    ? ''
                    : detail.unit_weight.toLocaleString('en-GB')}
                </Item>,
                <Item key="barcode" label="Barcode">
                  {copyable(detail.barcode, 'Copy barcode')}
                </Item>,
              ],
              [
                <Item key="location" label="Location">
                  {detail.location}
                </Item>,
                <Item key="commodity" label="Commodity Code">
                  {detail.commodity_code}
                </Item>,
                <Item key="origin" label="Country of Origin">
                  {detail.country_of_origin}
                </Item>,
              ],
              [
                <Item key="inactive" label="Inactive">
                  <FlagPill value={detail.inactive} />
                </Item>,
              ],
            ]}
          />
        </DetailSection>

        <DetailSection compact title="Supplier & Account Details" icon={TruckIcon}>
          <ItemRows
            columns={2}
            rows={[
              [
                <Item key="supplier" label="Supplier Account">
                  {copyable(detail.supplier_ref, 'Copy supplier account')}
                </Item>,
                <Item key="part" label="Supplier Part Number">
                  {detail.supplier_part_number}
                </Item>,
              ],
              [
                <Item key="nominal" label="Nominal Code">
                  {detail.nominal_code}
                </Item>,
                <Item key="purchase" label="Purchase Nominal Code">
                  {detail.purchase_nominal_code}
                </Item>,
              ],
              [
                <Item key="tax" label="Tax Code">
                  {detail.tax_code}
                </Item>,
              ],
            ]}
          />
        </DetailSection>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DetailSection compact title="Key Dates" icon={CalendarIcon}>
          <dl className="m-0 grid grid-cols-2 gap-y-4 xl:grid-cols-4">
            <DateCell icon={CalendarIcon} label="Last Sold">
              {detail.last_sale_date ? dateText(detail.last_sale_date) : ''}
            </DateCell>
            <DateCell icon={ShoppingCartIcon} label="Last Purchased">
              {detail.last_purchase_date ? dateText(detail.last_purchase_date) : ''}
            </DateCell>
            <DateCell icon={FileTextIcon} label="Last Stock Take">
              {detail.last_stock_take_date ? dateText(detail.last_stock_take_date) : ''}
            </DateCell>
            <DateCell icon={LayersIcon} label="Qty at Last Stock Take">
              {count(detail.qty_last_stock_take)}
            </DateCell>
          </dl>
        </DetailSection>

        <DetailSection compact title="Year to Date (YTD)" icon={PoundIcon}>
          <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-3">
            <MetricTile
              small
              icon={BoxesIcon}
              label="Qty Sold (YTD)"
              value={count(detail.qty_sold_ytd)}
            />
            <MetricTile
              small
              icon={PoundIcon}
              label="Sales (YTD)"
              value={money(detail.sales_ytd)}
            />
            <MetricTile
              small
              icon={PoundIcon}
              label="Cost (YTD)"
              value={money(detail.cost_ytd)}
            />
          </div>
        </DetailSection>
      </div>
    </div>
  )
}
