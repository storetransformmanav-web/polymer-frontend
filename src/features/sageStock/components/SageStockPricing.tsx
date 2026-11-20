import { useState } from 'react'
import { DETAIL_TD, DetailSection } from '../../../components/ui/DetailSection.tsx'
import {
  ActivityIcon,
  ChevronDownIcon,
  LayersIcon,
  ListChecksIcon,
  PoundIcon,
  SearchIcon,
  TagIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { SageStockDetail, SageStockPriceList } from '../../../lib/api/sageStock.ts'
import {
  count,
  fieldLabel,
  groupDiscountBands,
  looseValue,
  money,
  percent,
  type DiscountBand,
} from '../utils/format.ts'
import { MetricTile } from './SageStockPanels.tsx'
import { usePaging } from '../hooks/usePaging.ts'
import { NUMBER_TD, SCROLL_BOX, TH, TH_LEFT, TH_RIGHT } from '../utils/tableStyles.ts'

/** The search box of the Price Lists card. */
function SearchBox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex h-9 w-44 items-center gap-2 rounded-full border px-3 transition-colors focus-within:outline-2 sm:w-60">
      <SearchIcon width={15} height={15} className="text-text-muted shrink-0" />
      <input
        type="search"
        aria-label="Search price lists"
        placeholder="Search price lists…"
        maxLength={100}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.82rem] outline-none [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  )
}

/** The Price Lists table: searchable, in its own scrolling box, with the shared pagination under it. */
function PriceLists({ lists }: { lists: SageStockPriceList[] }) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? lists.filter((list) =>
        [list.pricing_ref, list.name, list.currency, list.calculation_method].some(
          (value) => value.toLowerCase().includes(needle),
        ),
      )
    : lists
  const paging = usePaging(shown.length, needle)
  const rows = shown.slice(paging.from, paging.to)

  return (
    <DetailSection
      flush
      title="Price Lists"
      icon={ListChecksIcon}
      count={lists.length}
      actions={
        lists.length > 0 ? <SearchBox value={query} onChange={setQuery} /> : undefined
      }
    >
      {lists.length === 0 ? (
        <p className="text-text-muted m-0 p-5 text-[0.85rem]">
          This item is on no price list.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-text-muted m-0 p-5 text-[0.85rem]">
          No price list matches “{query.trim()}”.
        </p>
      ) : (
        <>
          <div className={SCROLL_BOX}>
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  <th className={TH_LEFT}>Pricing Reference</th>
                  <th className={TH_LEFT}>Name</th>
                  <th className={`${TH} text-center`}>Currency</th>
                  <th className={TH_LEFT}>Calculation Method</th>
                  <th className={TH_RIGHT}>Calculation Value</th>
                  <th className={TH_RIGHT}>Price</th>
                  <th className={TH_RIGHT}>Customers</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((list, index) => (
                  <tr
                    key={`${list.pricing_ref}-${paging.from + index}`}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                  >
                    <td className={`${DETAIL_TD} font-semibold`}>
                      {list.pricing_ref || '—'}
                    </td>
                    <td className={DETAIL_TD}>{list.name || '—'}</td>
                    <td className={`${DETAIL_TD} text-center`}>
                      {list.currency ? (
                        <span className="bg-surface border-border inline-flex rounded-full border px-2.5 py-0.5 text-[0.78rem] font-semibold">
                          {list.currency}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
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
            </table>
          </div>
          <PaginationFooter
            compact
            page={paging.page}
            pageSize={paging.pageSize}
            total={shown.length}
            totalPages={paging.totalPages}
            onPageChange={paging.onPageChange}
            onPageSizeChange={paging.onPageSizeChange}
          />
        </>
      )}
    </DetailSection>
  )
}

/** Headings the API's own field names get; any other field is named from its key. */
const BAND_HEADINGS: Record<string, string> = {
  qty: 'Quantity (Qty)',
  quantity: 'Quantity (Qty)',
  rate: 'Rate',
}

/** One discount band: a row you click to open its quantity / rate table (scrolling, with paging). */
function Band({
  band,
  label,
  defaultOpen,
}: {
  band: DiscountBand
  label: string
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const paging = usePaging(band.rows.length, '')
  const keys: string[] = []
  for (const row of band.rows) {
    for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key)
  }
  const rows = band.rows.slice(paging.from, paging.to)
  const bodyId = `band-${label.replace(/\s+/g, '-')}`

  return (
    <div className="border-border-strong overflow-hidden rounded-xl border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="bg-accent-tint/60 hover:bg-accent-tint text-text flex w-full cursor-pointer items-center gap-2.5 border-none px-4 py-2.5 text-left text-[0.92rem] font-semibold transition-colors"
      >
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted shrink-0 transition-transform duration-200 ${
            open ? '' : '-rotate-90'
          }`}
        />
        {label}
      </button>
      {open && (
        <div id={bodyId} className="border-border-strong border-t">
          {band.rows.length === 0 ? (
            <p className="text-text-muted m-0 p-4 text-[0.85rem]">
              This band has no rows.
            </p>
          ) : (
            <>
              <div className={SCROLL_BOX}>
                <table className="w-full min-w-[420px] border-collapse">
                  <thead>
                    <tr>
                      {keys.map((key) => (
                        <th key={key} className={TH_LEFT}>
                          {BAND_HEADINGS[key.toLowerCase()] ?? fieldLabel(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={paging.from + index}
                        className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                      >
                        {keys.map((key, column) => (
                          <td
                            key={key}
                            className={`${DETAIL_TD} ${column === 0 ? 'font-semibold' : ''}`}
                          >
                            {looseValue(key, row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationFooter
                compact
                page={paging.page}
                pageSize={paging.pageSize}
                total={band.rows.length}
                totalPages={paging.totalPages}
                onPageChange={paging.onPageChange}
                onPageSizeChange={paging.onPageSizeChange}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The Pricing tab, after the reference design: **Pricing Summary** (four tinted tiles — sales price,
 * average cost, last purchase price, margin), **Price Lists** (a searchable table with its own scrolling
 * box and the shared pagination, the count in the title) and **Discount Bands** (one expandable row per
 * band, the first open, each with its quantity / rate table, scrolling and paging; the count is the
 * number of bands). The discount bands carry no documented fields, so they are read leniently
 * (`groupDiscountBands`: either bands holding their rows, or flat rows that name their band) and every
 * value shown is the API's.
 */
export function PricingPanel({ detail }: { detail: SageStockDetail }) {
  const bands = groupDiscountBands(detail.discount_bands)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DetailSection title="Pricing Summary" icon={TagIcon}>
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            icon={TagIcon}
            label="Sales Price"
            value={money(detail.sales_price)}
            tone="accent"
          />
          <MetricTile
            icon={PoundIcon}
            label="Average Cost"
            value={money(detail.average_cost)}
            tone="info"
          />
          <MetricTile
            icon={LayersIcon}
            label="Last Purchase Price"
            value={money(detail.last_purchase_price)}
            tone="violet"
          />
          <MetricTile
            icon={ActivityIcon}
            label="Margin"
            value={percent(detail.margin_percent)}
            tone="accent"
          />
        </div>
      </DetailSection>

      <PriceLists lists={detail.price_lists} />

      <DetailSection title="Discount Bands" icon={TagIcon} count={bands.length}>
        {bands.length === 0 ? (
          <p className="text-text-muted m-0 text-[0.85rem]">
            This item has no discount bands.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {bands.map((band, index) => (
              <Band
                key={`${band.band}-${index}`}
                band={band}
                label={`Band ${band.band || index + 1}`}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  )
}
