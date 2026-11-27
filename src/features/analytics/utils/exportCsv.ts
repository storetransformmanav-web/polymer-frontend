import { buildCsv, csvExportFilename, type CsvCell } from '../../../lib/csv.ts'
import type { SalesOverview } from '../../../lib/api/salesOverview.ts'

/**
 * The report on screen as CSV text: the totals, the trend and the three product lists, each with
 * its own header row. It is built from the answer already loaded (the API has no export for it);
 * `buildCsv` stops a title from running as a spreadsheet formula.
 */
export function buildSalesReportCsv(overview: SalesOverview): string {
  const { period, totals, levels, currency } = overview
  const sections: string[] = [
    buildCsv(
      ['Summary', 'Value', 'Change % on previous period'],
      [
        ['First day', period.date_from, ''],
        ['Last day', period.date_to, ''],
        ['Currency', currency ?? '', ''],
        ['Revenue', totals.revenue, totals.revenue_change_percent],
        ['Orders', totals.orders, totals.orders_change_percent],
        ['Units sold', totals.units_sold, totals.units_change_percent],
        ['Average order value', totals.average_order_value, ''],
        ['Top sellers', levels.top, ''],
        ['Good sellers', levels.good, ''],
        ['Low sellers', levels.low, ''],
        ['No sales', levels.none, ''],
      ],
    ),
    buildCsv(
      ['Period start', 'Revenue', 'Orders', 'Units sold'],
      overview.trend.map((point) => [
        point.period_start,
        point.revenue,
        point.orders,
        point.units_sold,
      ]),
    ),
  ]

  const productRows: CsvCell[][] = [
    ...overview.top_products.map((item) => ['Top sellers', item] as const),
    ...overview.low_products.map((item) => ['Low sellers', item] as const),
  ].map(([list, item]) => [
    list,
    item.rank,
    item.title,
    item.handle,
    item.status,
    item.units_sold,
    item.revenue,
    item.orders,
    item.share_percent,
    item.total_inventory,
    item.last_sold_on,
  ])
  for (const item of overview.unsold_products) {
    productRows.push([
      'Unsold products',
      '',
      item.title,
      item.handle,
      item.status,
      0,
      0,
      0,
      0,
      item.total_inventory,
      item.last_sold_on,
    ])
  }
  sections.push(
    buildCsv(
      [
        'List',
        'Rank',
        'Product',
        'Handle',
        'Status',
        'Units sold',
        'Revenue',
        'Orders',
        'Share %',
        'Inventory',
        'Last sold',
      ],
      productRows,
    ),
  )
  return sections.join('\r\n')
}

export const salesReportFilename = (shop: string | undefined) =>
  csvExportFilename('sales_report', shop)
