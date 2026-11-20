import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { DETAIL_TD, DetailSection } from '../../../components/ui/DetailSection.tsx'
import {
  BoxesIcon,
  LayersIcon,
  ListChecksIcon,
  SearchIcon,
  ShoppingCartIcon,
  TruckIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { SageStockDetail } from '../../../lib/api/sageStock.ts'
import { usePaging } from '../hooks/usePaging.ts'
import { count, dateText, money } from '../utils/format.ts'
import {
  orderStatusPill,
  readOpenOrderLines,
  sumOf,
  type OpenOrderLine,
} from '../utils/openOrders.ts'
import {
  FILL_BOX,
  NUMBER_TD,
  TH_CENTER,
  TH_LEFT,
  TH_RIGHT,
} from '../utils/tableStyles.ts'
import { FillCard } from './FillCard.tsx'
import { MetricTile } from './SageStockPanels.tsx'

/** The search box of the Open Order Lines card. */
function SearchBox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex h-9 w-56 items-center gap-2 rounded-full border px-3 transition-colors focus-within:outline-2 sm:w-72">
      <SearchIcon width={15} height={15} className="text-text-muted shrink-0" />
      <input
        type="search"
        aria-label="Search open order lines"
        placeholder="Search by order no., customer or account…"
        maxLength={100}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.82rem] outline-none [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  )
}

function matches(line: OpenOrderLine, needle: string): boolean {
  return [line.orderNumber, line.customerName, line.accountRef].some((value) =>
    value.toLowerCase().includes(needle),
  )
}

/** The Open Order Lines table: searchable, in its own scrolling box, with the shared pagination under it. */
function OpenOrderLines({ lines }: { lines: OpenOrderLine[] }) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = needle ? lines.filter((line) => matches(line, needle)) : lines
  const paging = usePaging(shown.length, needle)
  const rows = shown.slice(paging.from, paging.to)

  return (
    <FillCard
      title="Open Order Lines"
      icon={ListChecksIcon}
      actions={
        lines.length > 0 ? <SearchBox value={query} onChange={setQuery} /> : undefined
      }
    >
      {shown.length === 0 ? (
        <p className="text-text-muted m-0 p-4 text-[0.85rem]">
          No open order line matches “{query.trim()}”.
        </p>
      ) : (
        <>
          <div className={FILL_BOX}>
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr>
                  <th className={TH_LEFT}>Order Number</th>
                  <th className={TH_LEFT}>Order Date</th>
                  <th className={TH_CENTER}>Status</th>
                  <th className={TH_LEFT}>Account Ref</th>
                  <th className={TH_LEFT}>Customer Name</th>
                  <th className={TH_RIGHT}>Qty Ordered</th>
                  <th className={TH_RIGHT}>Qty Despatched</th>
                  <th className={TH_RIGHT}>Qty Outstanding</th>
                  <th className={TH_RIGHT}>Unit Price</th>
                  <th className={TH_RIGHT}>Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((line, index) => {
                  const pill = orderStatusPill(line.status)
                  return (
                    <tr
                      key={`${line.orderNumber}-${paging.from + index}`}
                      className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                    >
                      <td className={`${DETAIL_TD} font-semibold`}>
                        {line.orderNumber || '—'}
                      </td>
                      <td className={DETAIL_TD}>{dateText(line.orderDate)}</td>
                      <td className={`${DETAIL_TD} text-center`}>
                        {line.status ? (
                          <Badge tone={pill.tone} className="w-[7.5rem] justify-center">
                            {pill.label}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={DETAIL_TD}>{line.accountRef || '—'}</td>
                      <td className={DETAIL_TD}>{line.customerName || '—'}</td>
                      <td className={NUMBER_TD}>{count(line.qtyOrdered)}</td>
                      <td className={NUMBER_TD}>{count(line.qtyDespatched)}</td>
                      <td className={NUMBER_TD}>{count(line.qtyOutstanding)}</td>
                      <td className={NUMBER_TD}>{money(line.unitPrice)}</td>
                      <td className={`${NUMBER_TD} font-semibold`}>{money(line.net)}</td>
                    </tr>
                  )
                })}
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
    </FillCard>
  )
}

/**
 * The Open Orders tab, after the reference design: **Open Orders Summary** (four tinted tiles — the number
 * of open order lines and the quantity ordered, despatched and outstanding, each **calculated from the
 * returned lines**) and **Open Order Lines** (a searchable table in its own scrolling box that takes the
 * tab's height, with the shared pagination fixed under it). The lines are the API's `open_order_lines`,
 * read by `readOpenOrderLines`; nothing else is shown.
 */
export function OpenOrdersPanel({ detail }: { detail: SageStockDetail }) {
  const lines = readOpenOrderLines(detail.open_order_lines)
  if (lines.length === 0) {
    return (
      <DetailSection compact title="Open Orders Summary" icon={ShoppingCartIcon}>
        <p className="text-text-muted m-0 text-[0.85rem]">
          This item has no open order lines.
        </p>
      </DetailSection>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:flex-1">
      <DetailSection compact title="Open Orders Summary" icon={ShoppingCartIcon}>
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            icon={ListChecksIcon}
            label="Total Orders"
            value={count(lines.length)}
            tone="accent"
          />
          <MetricTile
            icon={LayersIcon}
            label="Qty Ordered"
            value={`Σ ${count(sumOf(lines, 'qtyOrdered'))}`}
            tone="info"
          />
          <MetricTile
            icon={TruckIcon}
            label="Qty Despatched"
            value={`Σ ${count(sumOf(lines, 'qtyDespatched'))}`}
            tone="violet"
          />
          <MetricTile
            icon={BoxesIcon}
            label="Qty Outstanding"
            value={`Σ ${count(sumOf(lines, 'qtyOutstanding'))}`}
            tone="accent"
          />
        </div>
      </DetailSection>

      <OpenOrderLines lines={lines} />
    </div>
  )
}
