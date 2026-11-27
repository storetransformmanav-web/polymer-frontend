import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type {
  SalesOverview,
  SalesOverviewParams,
  SalesProduct,
  SoldProduct,
} from '../../../lib/api/salesOverview.ts'
import { formatPrice } from '../../../lib/format.ts'
import { useFullSalesLists } from '../hooks/useFullSalesLists.ts'
import { formatCount, formatDayShort } from '../utils/format.ts'
import { CARD } from './AnalyticsCard.tsx'

/** Rows each list shows before "View all": fewer on a short window, so the page still fits. */
const TALL_ROWS = 6
const SHORT_ROWS = 4
const TALL_WINDOW = '(min-height: 880px)'

const TH_BASE = 'bg-table-head sticky top-0 z-[1] px-2.5 py-2'
const TH = `${TH_BASE} text-right`
const TH_LEFT = `${TH_BASE} text-left`
const TD = 'px-2.5 py-1.5 text-right align-middle tabular-nums'
const ROW = 'border-border hover:bg-accent-tint/60 border-b last:border-b-0'

function ProductName({ product }: { product: SalesProduct }) {
  return (
    <Link
      to={`/products/${encodeURIComponent(product.id)}`}
      title={product.title}
      className="text-text hover:text-accent block truncate font-semibold no-underline hover:underline"
    >
      {product.title}
    </Link>
  )
}

interface ListState<T> {
  /** The rows to draw. */
  rows: T[]
  open: boolean
  /** The longer list is still on its way. */
  loading: boolean
  error: string | null
  retry: () => void
  toggle: () => void
}

/**
 * One list's rows: the first few of the page's answer, or — after "View all" — as many as the
 * report gives (asked for then). The short rows stay on screen while that loads.
 */
function useList<T>(
  params: SalesOverviewParams,
  short: T[],
  pick: (overview: SalesOverview) => T[],
  rows: number,
): ListState<T> {
  const [open, setOpen] = useState(false)
  const full = useFullSalesLists(params, open)
  const longer = open && full.overview ? pick(full.overview) : null
  return {
    rows: longer ?? short.slice(0, rows),
    open,
    loading: open && !full.overview && !full.error,
    error: open ? full.error : null,
    retry: full.retry,
    toggle: () => setOpen((current) => !current),
  }
}

/** The card around a list: dot, title, "View all N", the table and a line under it. */
function ListCard<T>({
  title,
  dot,
  total,
  list,
  empty,
  note,
  head,
  children,
}: {
  title: string
  dot: string
  /** How many products are in this group altogether. */
  total: number
  list: ListState<T>
  empty: string
  note?: ReactNode
  head: ReactNode
  children: ReactNode
}) {
  const shown = list.rows.length
  // The report stops at its own limit, which can be fewer than the group holds.
  const cut = list.open && !list.loading && !list.error && shown < total

  return (
    <section aria-label={title} className={`${CARD} flex min-w-0 flex-col overflow-clip`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <h2 className="text-text m-0 flex items-center gap-2.5 text-[0.95rem] font-bold">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ${dot}`} />
          {title}
        </h2>
        {(list.open || total > shown) && (
          <button
            type="button"
            aria-expanded={list.open}
            onClick={list.toggle}
            className="text-accent cursor-pointer border-none bg-transparent p-0 text-[0.8rem] font-semibold underline underline-offset-2"
          >
            {list.open ? 'Show less' : `View all ${formatCount(total)}`}
          </button>
        )}
      </div>

      {shown === 0 ? (
        <p className="text-text-muted border-border m-0 border-t px-4 py-8 text-center text-[0.82rem]">
          {empty}
        </p>
      ) : (
        <div
          tabIndex={list.open ? 0 : undefined}
          role={list.open ? 'region' : undefined}
          aria-label={list.open ? `${title}, scrollable list` : undefined}
          className={`relative overflow-x-auto ${list.open ? 'max-h-[17rem] overflow-y-auto' : ''}`}
        >
          <table className="w-full table-fixed border-collapse text-[0.8rem]">
            <thead className="text-text text-[0.68rem] font-bold uppercase">{head}</thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}

      <div
        role="status"
        className="text-text-muted flex flex-col gap-1 px-4 py-2 text-[0.74rem] empty:hidden"
      >
        {list.loading && <p className="m-0">Loading the full list…</p>}
        {list.error && (
          <p className="text-danger m-0">
            {list.error}{' '}
            <button
              type="button"
              onClick={list.retry}
              className="text-accent cursor-pointer border-none bg-transparent p-0 font-semibold underline"
            >
              Try again
            </button>
          </p>
        )}
        {cut && (
          <p className="m-0">
            Showing {formatCount(shown)} of {formatCount(total)}: the most the report
            returns.
          </p>
        )}
        {shown > 0 && note && <p className="m-0">{note}</p>}
      </div>
    </section>
  )
}

/**
 * The three product lists under the chart, side by side: the top sellers (each with its share of
 * the revenue), the low sellers and the active products that sold nothing. Every row and count is
 * the answer's, in the order it sent them.
 */
export function SalesLists({
  overview,
  params,
}: {
  overview: SalesOverview
  /** What the page asked with, so "View all" asks about the same period and store. */
  params: SalesOverviewParams
}) {
  const { currency, levels } = overview
  const rows = useMediaQuery(TALL_WINDOW) ? TALL_ROWS : SHORT_ROWS
  const top = useList<SoldProduct>(
    params,
    overview.top_products,
    (o) => o.top_products,
    rows,
  )
  const low = useList<SoldProduct>(
    params,
    overview.low_products,
    (o) => o.low_products,
    rows,
  )
  const activeOnly = (products: SalesProduct[]) =>
    products.filter(
      (product) => !product.status || product.status.toUpperCase() === 'ACTIVE',
    )
  const unsold = useList<SalesProduct>(
    params,
    activeOnly(overview.unsold_products),
    (o) => activeOnly(o.unsold_products),
    rows,
  )

  // A bar is as long as its share of revenue next to the biggest share shown.
  const biggest = Math.max(0, ...top.rows.map((product) => product.share_percent ?? 0))
  const hasFree = low.rows.some((product) => product.revenue === 0)
  const mostStockFirst = unsold.rows.every(
    (product, index) =>
      index === 0 ||
      (unsold.rows[index - 1].total_inventory ?? 0) >= (product.total_inventory ?? 0),
  )

  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-3">
      <ListCard
        title="Top sellers"
        dot="bg-accent"
        total={levels.top}
        list={top}
        empty="Nothing sold in this period."
        head={
          <tr>
            <th scope="col" className={`${TH_LEFT} w-9 pl-4`}>
              #
            </th>
            <th scope="col" className={TH_LEFT}>
              Product
            </th>
            <th scope="col" className={`${TH} w-14`}>
              Units
            </th>
            <th scope="col" className={`${TH} w-24 pr-4`}>
              Revenue
            </th>
          </tr>
        }
      >
        {top.rows.map((product, index) => (
          <tr key={product.id} className={ROW}>
            <td className="text-accent py-1.5 pr-1 pl-4 align-middle font-bold tabular-nums">
              {product.rank ?? index + 1}
            </td>
            <td className="px-2.5 py-1.5 align-middle">
              <ProductName product={product} />
              {typeof product.share_percent === 'number' && (
                <span className="mt-0.5 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="bg-surface border-border relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full border"
                  >
                    <span
                      className="bg-accent absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${biggest > 0 ? (product.share_percent / biggest) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span className="text-text-muted shrink-0 text-[0.72rem]">
                    {product.share_percent.toLocaleString('en-GB', {
                      maximumFractionDigits: 1,
                    })}
                    % of revenue
                  </span>
                </span>
              )}
            </td>
            <td className={TD}>{formatCount(product.units_sold)}</td>
            <td className={`${TD} pr-4 font-bold`}>
              {formatPrice(product.revenue, currency)}
            </td>
          </tr>
        ))}
      </ListCard>

      <ListCard
        title="Low sellers"
        dot="bg-warning"
        total={levels.low}
        list={low}
        empty="No low sellers in this period."
        note={
          hasFree
            ? `Rows at ${formatPrice(0, currency)} sold units but brought in no revenue.`
            : undefined
        }
        head={
          <tr>
            <th scope="col" className={`${TH_LEFT} pl-4`}>
              Product
            </th>
            <th scope="col" className={`${TH} w-14`}>
              Units
            </th>
            <th scope="col" className={`${TH} w-20`}>
              Revenue
            </th>
            <th scope="col" className={`${TH} w-16 pr-4`}>
              Stock
            </th>
          </tr>
        }
      >
        {low.rows.map((product) => (
          <tr key={product.id} className={ROW}>
            <td className="py-1.5 pr-2.5 pl-4 align-middle">
              <ProductName product={product} />
            </td>
            <td className={TD}>{formatCount(product.units_sold)}</td>
            <td
              className={`${TD} font-bold ${product.revenue === 0 ? 'text-warning' : ''}`}
            >
              {formatPrice(product.revenue, currency)}
            </td>
            <td className={`${TD} pr-4`}>{formatCount(product.total_inventory)}</td>
          </tr>
        ))}
      </ListCard>

      <ListCard
        title="Active, not selling"
        dot="bg-text-muted"
        total={levels.none_active ?? levels.none}
        list={unsold}
        empty="Every active product sold something in this period."
        note={
          mostStockFirst && unsold.rows.length > 1
            ? 'Most stock first: money sitting on the shelves.'
            : undefined
        }
        head={
          <tr>
            <th scope="col" className={`${TH_LEFT} pl-4`}>
              Product
            </th>
            <th scope="col" className={`${TH} w-16`}>
              Stock
            </th>
            <th scope="col" className={`${TH} w-28 pr-4`}>
              Last sold
            </th>
          </tr>
        }
      >
        {unsold.rows.map((product) => (
          <tr key={product.id} className={ROW}>
            <td className="py-1.5 pr-2.5 pl-4 align-middle">
              <ProductName product={product} />
            </td>
            <td className={`${TD} font-bold`}>{formatCount(product.total_inventory)}</td>
            <td className={`${TD} text-text-muted pr-4 whitespace-nowrap`}>
              {product.last_sold_on ? formatDayShort(product.last_sold_on) : 'Never'}
            </td>
          </tr>
        ))}
      </ListCard>
    </div>
  )
}
