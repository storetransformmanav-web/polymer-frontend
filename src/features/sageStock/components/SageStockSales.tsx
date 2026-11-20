import { DETAIL_TD, DetailSection } from '../../../components/ui/DetailSection.tsx'
import {
  ActivityIcon,
  BoxesIcon,
  CalendarIcon,
  PoundIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { SageStockDetail } from '../../../lib/api/sageStock.ts'
import { usePaging } from '../hooks/usePaging.ts'
import { count, dateText, money, monthText, percent } from '../utils/format.ts'
import { FILL_BOX, NUMBER_TD, TH_LEFT, TH_RIGHT } from '../utils/tableStyles.ts'
import { FillCard } from './FillCard.tsx'
import { DateCell, MetricTile } from './SageStockPanels.tsx'

/** The Monthly Sales Performance table: in its own scrolling box with the shared pagination under it. */
function MonthlySales({ detail }: { detail: SageStockDetail }) {
  const paging = usePaging(detail.months.length)
  const rows = detail.months.slice(paging.from, paging.to)
  return (
    <FillCard title="Monthly Sales Performance" icon={ActivityIcon}>
      {detail.months.length === 0 ? (
        <p className="text-text-muted m-0 p-4 text-[0.85rem]">No monthly figures.</p>
      ) : (
        <>
          <div className={FILL_BOX}>
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <th className={TH_LEFT}>Month</th>
                  <th className={TH_LEFT}>Period</th>
                  <th className={TH_RIGHT}>Qty Sold</th>
                  <th className={TH_RIGHT}>Sales</th>
                  <th className={TH_RIGHT}>Cost</th>
                  <th className={TH_RIGHT}>Prior Year Qty Sold</th>
                  <th className={TH_RIGHT}>Prior Year Sales</th>
                  <th className={TH_RIGHT}>Prior Year Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((month, index) => (
                  <tr
                    key={`${month.month}-${paging.from + index}`}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                  >
                    <td className={`${DETAIL_TD} font-semibold`}>
                      {monthText(month.month)}
                    </td>
                    <td className={DETAIL_TD}>{month.period ?? '—'}</td>
                    <td className={NUMBER_TD}>{count(month.qty_sold)}</td>
                    <td className={NUMBER_TD}>{money(month.sales)}</td>
                    <td className={NUMBER_TD}>{money(month.cost)}</td>
                    <td className={NUMBER_TD}>{count(month.prior_year_qty_sold)}</td>
                    <td className={NUMBER_TD}>{money(month.prior_year_sales)}</td>
                    <td className={NUMBER_TD}>{money(month.prior_year_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter
            compact
            page={paging.page}
            pageSize={paging.pageSize}
            total={detail.months.length}
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
 * The Sales tab, after the reference design: **Sales Summary** (four tinted tiles — quantity sold, sales,
 * cost, margin) beside **Key Sales Dates** (last sold, last stock take); **Monthly Sales Performance**
 * (each month of the financial year beside the same month a year earlier, in its own scrolling box with
 * the shared pagination). Every value is the details answer's; a missing one is a dash.
 */
export function SalesPanel({ detail }: { detail: SageStockDetail }) {
  const lastSold = detail.last_sale_date ? dateText(detail.last_sale_date) : ''
  const lastTake = detail.last_stock_take_date
    ? dateText(detail.last_stock_take_date)
    : ''
  return (
    <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DetailSection compact title="Sales Summary" icon={ActivityIcon}>
          <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              small
              icon={BoxesIcon}
              label="Qty Sold (YTD)"
              value={count(detail.qty_sold_ytd)}
              tone="accent"
            />
            <MetricTile
              small
              icon={PoundIcon}
              label="Sales (YTD)"
              value={money(detail.sales_ytd)}
              tone="info"
            />
            <MetricTile
              small
              icon={PoundIcon}
              label="Cost (YTD)"
              value={money(detail.cost_ytd)}
              tone="violet"
            />
            <MetricTile
              small
              icon={ActivityIcon}
              label="Margin"
              value={percent(detail.margin_percent)}
              tone="accent"
            />
          </div>
        </DetailSection>

        <DetailSection compact title="Key Sales Dates" icon={CalendarIcon}>
          <dl className="m-0 grid grid-cols-2 gap-y-4">
            <DateCell icon={CalendarIcon} label="Last Sold">
              {lastSold}
            </DateCell>
            <DateCell icon={CalendarIcon} label="Last Stock Take">
              {lastTake}
            </DateCell>
          </dl>
        </DetailSection>
      </div>

      <MonthlySales detail={detail} />
    </div>
  )
}
