import type { ProductSort } from '../../../lib/api/endpoints.ts'
import type { ColumnConfig as BaseColumnConfig } from '../../../lib/columnConfig.ts'

/**
 * The products table's columns. The tick box, the **Image**, the **Product** name (always the
 * wide one) and **Actions** are fixed; every other column is here, can be shown or hidden and put
 * in any order from the Columns menu (`components/ui/ColumnsMenu.tsx`). Only what the list answer
 * (`GET /products`) carries is a column: the store admin's Channels and Catalogs have no field in
 * it, so they are not offered.
 */
export const PRODUCT_COLUMN_IDS = [
  'variants',
  'status',
  'inventory',
  'price',
  'category',
  'product_type',
  'vendor',
  'tags',
  'handle',
  'store',
  'created',
  'updated',
  'synced',
] as const

export type ProductColumnId = (typeof PRODUCT_COLUMN_IDS)[number]

export type ProductColumnConfig = BaseColumnConfig<ProductColumnId>

export interface ProductColumnDef {
  id: ProductColumnId
  label: string
  /** Width in rem (the table is fixed-layout; the product name takes what is left). */
  width: number
  align: 'left' | 'center' | 'right'
  /** The API sort this column's header applies, when it has one. */
  sort?: ProductSort
}

const column = (
  id: ProductColumnId,
  label: string,
  width: number,
  align: ProductColumnDef['align'] = 'left',
  sort?: ProductSort,
): [ProductColumnId, ProductColumnDef] => [id, { id, label, width, align, sort }]

export const PRODUCT_COLUMNS: Record<ProductColumnId, ProductColumnDef> =
  Object.fromEntries([
    column('variants', 'Variants', 7, 'center'),
    column('status', 'Status', 8, 'center'),
    column('inventory', 'Inventory', 9, 'right', 'inventory'),
    column('price', 'Price', 10, 'right', 'price'),
    column('category', 'Category', 12),
    column('product_type', 'Product type', 11),
    column('vendor', 'Vendor', 11),
    column('tags', 'Tags', 14),
    column('handle', 'Handle', 12),
    column('store', 'Store', 11),
    column('created', 'Created', 9, 'center', 'created_at'),
    column('updated', 'Updated', 9, 'center', 'updated_at'),
    // Not sortable: the Sort by box has no Last synced choice (removed by choice).
    column('synced', 'Last synced', 9, 'center'),
  ]) as Record<ProductColumnId, ProductColumnDef>

/** Shown to begin with, in this order: tick, Image, Product, then these, then Actions. */
export const DEFAULT_VISIBLE_PRODUCT_COLUMNS: ProductColumnId[] = [
  'variants',
  'status',
  'inventory',
  'price',
]

/** Width of the fixed columns, in rem: the tick box, Image, the least the Product name gets, Actions. */
export const PRODUCT_FIXED_COLUMNS_REM = 3 + 4 + 16 + 6
export const PRODUCT_ACTIONS_COLUMN_REM = 6

/** The columns to draw, in order. */
export function shownProductColumns(config: ProductColumnConfig): ProductColumnDef[] {
  return config.order
    .filter((id) => config.visible.includes(id))
    .map((id) => PRODUCT_COLUMNS[id])
}

/** The table's least width in rem: the fixed columns and the shown ones. */
export function productTableMinWidthRem(columns: ProductColumnDef[]): number {
  return (
    PRODUCT_FIXED_COLUMNS_REM + columns.reduce((total, shown) => total + shown.width, 0)
  )
}
