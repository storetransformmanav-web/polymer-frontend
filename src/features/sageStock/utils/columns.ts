import type { ColumnConfig as BaseColumnConfig } from '../../../lib/columnConfig.ts'
import type { SageStockSort } from '../../../lib/api/sageStock.ts'

/**
 * The Sage stock table's columns. Every column can be shown, hidden and put in order from the Columns
 * menu (`components/ui/ColumnsMenu.tsx`); only what the list answer carries is a column. The API has no
 * call for one stock item, so there is no Action column.
 */
export const SAGE_STOCK_COLUMN_IDS = [
  'code',
  'description',
  'category',
  'unit',
  'status',
  'inStock',
  'allocated',
  'free',
  'onOrder',
  'reorderLevel',
  'reorderQty',
  'salesPrice',
  'averageCost',
  'lastPurchasePrice',
  'margin',
  'stockValue',
  'soldYtd',
  'salesYtd',
  'lastSold',
  'lastPurchased',
  'supplier',
  'supplierPart',
  'barcode',
  'location',
  'taxCode',
  'webPublished',
  'inactive',
  'shopify',
  'shopifyStock',
] as const

export type SageStockColumnId = (typeof SAGE_STOCK_COLUMN_IDS)[number]

export type SageStockColumnConfig = BaseColumnConfig<SageStockColumnId>

/** Shown to begin with, in this order. */
export const DEFAULT_VISIBLE_SAGE_STOCK_COLUMNS: SageStockColumnId[] = [
  'code',
  'shopify',
  'category',
  'status',
  'stockValue',
  'lastSold',
  'location',
]

export interface SageStockColumnDef {
  id: SageStockColumnId
  label: string
  /** Width in rem (the table is fixed-layout). */
  width: number
  /** The heading and every cell of the column line up this way. */
  align: 'left' | 'center' | 'right'
  /** The API's `sort` value the heading's button applies, for the columns it can sort by. */
  sort?: SageStockSort
}

const column = (
  id: SageStockColumnId,
  label: string,
  width: number,
  align: SageStockColumnDef['align'] = 'left',
  sort?: SageStockSort,
): [SageStockColumnId, SageStockColumnDef] => [id, { id, label, width, align, sort }]

export const SAGE_STOCK_COLUMNS: Record<SageStockColumnId, SageStockColumnDef> =
  Object.fromEntries([
    column('code', 'Stock Code', 9, 'left', 'stock_code'),
    column('description', 'Description', 22, 'left', 'description'),
    column('category', 'Category', 11, 'left', 'category'),
    column('unit', 'Unit of Sale', 7, 'right'),
    column('status', 'Status', 9.5, 'center'),
    column('inStock', 'In Stock', 7, 'right', 'qty_in_stock'),
    column('allocated', 'Allocated', 7, 'right'),
    column('free', 'Free', 6, 'right', 'qty_free'),
    column('onOrder', 'On Order', 7, 'right'),
    column('reorderLevel', 'Reorder Level', 8, 'right'),
    column('reorderQty', 'Reorder Qty', 8, 'right'),
    column('salesPrice', 'Sales Price', 8, 'right', 'sales_price'),
    column('averageCost', 'Average Cost', 8, 'right'),
    column('lastPurchasePrice', 'Last Purchase Price', 9, 'right'),
    column('margin', 'Margin', 6.5, 'right', 'margin_percent'),
    column('stockValue', 'Stock Value', 8.5, 'right', 'stock_value'),
    column('soldYtd', 'Qty Sold YTD', 8, 'right', 'qty_sold_ytd'),
    column('salesYtd', 'Sales YTD', 8.5, 'right', 'sales_ytd'),
    column('lastSold', 'Last Sold', 8, 'left', 'last_sale_date'),
    column('lastPurchased', 'Last Purchased', 8.5),
    column('supplier', 'Supplier', 8),
    column('supplierPart', 'Supplier Part No.', 10),
    column('barcode', 'Barcode', 8),
    column('location', 'Location', 8),
    column('taxCode', 'Tax Code', 6, 'center'),
    column('webPublished', 'Web Published', 7.5, 'center'),
    column('inactive', 'Inactive', 6.5, 'center'),
    column('shopify', 'Shopify Product', 17),
    column('shopifyStock', 'Shopify Stock', 7.5, 'right'),
  ]) as Record<SageStockColumnId, SageStockColumnDef>

/** The columns to draw, in order. */
export function shownSageStockColumns(
  config: SageStockColumnConfig,
): SageStockColumnDef[] {
  return config.order
    .filter((id) => config.visible.includes(id))
    .map((id) => SAGE_STOCK_COLUMNS[id])
}

/** The table's least width in rem: the shown columns. */
export function sageStockTableMinWidthRem(
  columns: readonly SageStockColumnDef[],
): number {
  return columns.reduce((total, shown) => total + shown.width, 0)
}
