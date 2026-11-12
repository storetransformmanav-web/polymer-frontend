import type { ColumnConfig as BaseColumnConfig } from '../../../lib/columnConfig.ts'

/**
 * The orders table's columns. **Order** (the number, always first) and **Actions** (always last)
 * are fixed; every other column is here, can be shown or hidden and put in any order from the
 * Columns menu (`components/ui/ColumnsMenu.tsx`). Only what the list answer (`GET /orders`)
 * carries is a column: the store admin's Fulfill by, Delivery status, Delivery method,
 * Destination, PO number and Label status have no field in it, so they are not offered.
 */
export const ORDER_COLUMN_IDS = [
  'created',
  'customer',
  'email',
  'payment_status',
  'fulfillment_status',
  'items',
  'total',
  'store',
  'channel',
  'payment_method',
  'tags',
  'products',
  'return_status',
  'phone',
  'subtotal',
  'discounts',
  'shipping',
  'tax',
  'refunded',
  'net_payment',
  'updated',
  'closed',
  'cancelled',
] as const

export type OrderColumnId = (typeof ORDER_COLUMN_IDS)[number]

export type OrderColumnConfig = BaseColumnConfig<OrderColumnId>

export interface OrderColumnDef {
  id: OrderColumnId
  label: string
  /** Width in rem (the table is fixed-layout, so every column has one). */
  width: number
  align: 'left' | 'center' | 'right'
}

const column = (
  id: OrderColumnId,
  label: string,
  width: number,
  align: OrderColumnDef['align'] = 'left',
): [OrderColumnId, OrderColumnDef] => [id, { id, label, width, align }]

export const ORDER_COLUMNS: Record<OrderColumnId, OrderColumnDef> = Object.fromEntries([
  column('created', 'Created date', 11),
  column('customer', 'Customer name', 10),
  column('email', 'Email', 12),
  // The pills are 9.5rem wide, so these two keep the room they always had.
  column('payment_status', 'Payment status', 10, 'center'),
  column('fulfillment_status', 'Fulfillment status', 10, 'center'),
  column('items', 'Items', 5, 'right'),
  column('total', 'Total price', 7, 'right'),
  column('store', 'Store', 11),
  column('channel', 'Channel', 9),
  column('payment_method', 'Payment method', 11),
  column('tags', 'Tags', 12),
  column('products', 'Products', 16),
  column('return_status', 'Return status', 9, 'center'),
  column('phone', 'Customer phone', 10),
  column('subtotal', 'Subtotal', 7, 'right'),
  column('discounts', 'Discounts', 7, 'right'),
  column('shipping', 'Shipping', 7, 'right'),
  column('tax', 'Tax', 6, 'right'),
  column('refunded', 'Refunded', 7, 'right'),
  column('net_payment', 'Net payment', 8, 'right'),
  column('updated', 'Updated date', 11),
  column('closed', 'Closed date', 11),
  column('cancelled', 'Cancelled date', 11),
]) as Record<OrderColumnId, OrderColumnDef>

/** Shown to begin with, in this order: Order, then these, then Actions. */
export const DEFAULT_VISIBLE_ORDER_COLUMNS: OrderColumnId[] = [
  'created',
  'customer',
  'email',
  'payment_status',
  'fulfillment_status',
  'items',
  'total',
]

/** Width of the fixed columns, in rem: Order and Actions. */
export const ORDER_NUMBER_COLUMN_REM = 6
export const ORDER_ACTIONS_COLUMN_REM = 5

/** The columns to draw, in order. */
export function shownOrderColumns(config: OrderColumnConfig): OrderColumnDef[] {
  return config.order
    .filter((id) => config.visible.includes(id))
    .map((id) => ORDER_COLUMNS[id])
}

/** The table's least width in rem: Order, the shown columns and Actions. */
export function orderTableMinWidthRem(columns: OrderColumnDef[]): number {
  return (
    ORDER_NUMBER_COLUMN_REM +
    ORDER_ACTIONS_COLUMN_REM +
    columns.reduce((total, shown) => total + shown.width, 0)
  )
}
