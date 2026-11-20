import type { ColumnConfig as BaseColumnConfig } from '../../../lib/columnConfig.ts'
import type { SageOrderSort } from '../../../lib/api/sageOrders.ts'

/**
 * The Sage orders table's columns. Every column can be shown, hidden and put in order from the Columns
 * menu (`components/ui/ColumnsMenu.tsx`); only what the list answer carries is a column. **Action**
 * (View, which opens the order's own page) is always last and is not part of the choice.
 */
export const SAGE_ORDER_COLUMN_IDS = [
  'number',
  'date',
  'customer',
  'customerOrder',
  'status',
  'despatchDate',
  'net',
  'tax',
  'gross',
  'invoice',
  'allocation',
  'despatchStatus',
  'deliveryName',
  'contact',
  'takenBy',
  'carriage',
  'prepaid',
  'courier',
  'lines',
  'units',
  'unitsOutstanding',
  'currency',
] as const

export type SageOrderColumnId = (typeof SAGE_ORDER_COLUMN_IDS)[number]

export type SageOrderColumnConfig = BaseColumnConfig<SageOrderColumnId>

/** Shown to begin with, in this order. */
export const DEFAULT_VISIBLE_SAGE_ORDER_COLUMNS: SageOrderColumnId[] = [
  'number',
  'date',
  'customer',
  'customerOrder',
  'status',
  'despatchDate',
  'net',
  'tax',
  'gross',
  'invoice',
]

export interface SageOrderColumnDef {
  id: SageOrderColumnId
  label: string
  /** Width in rem (the table is fixed-layout). */
  width: number
  /** The heading and every cell of the column line up this way. */
  align: 'left' | 'center' | 'right'
  /** The API's `sort` value the heading's button applies, for the columns it can sort by. */
  sort?: SageOrderSort
}

const column = (
  id: SageOrderColumnId,
  label: string,
  width: number,
  align: SageOrderColumnDef['align'] = 'left',
  sort?: SageOrderSort,
): [SageOrderColumnId, SageOrderColumnDef] => [id, { id, label, width, align, sort }]

export const SAGE_ORDER_COLUMNS: Record<SageOrderColumnId, SageOrderColumnDef> =
  Object.fromEntries([
    column('number', 'Order Number', 9, 'left', 'number'),
    column('date', 'Order Date', 8.5, 'left', 'date'),
    column('customer', 'Customer', 16, 'left', 'customer'),
    column('customerOrder', 'Customer Order No', 10),
    column('status', 'Status', 9.5, 'center'),
    column('despatchDate', 'Despatch Date', 8.5, 'left', 'despatch_date'),
    column('net', 'Net', 7.5, 'right'),
    column('tax', 'Tax', 7, 'right'),
    column('gross', 'Gross', 8, 'right', 'total'),
    column('invoice', 'Invoice Number', 9),
    column('allocation', 'Allocation Status', 10),
    column('despatchStatus', 'Despatch Status', 10),
    column('deliveryName', 'Delivery Name', 13),
    column('contact', 'Contact', 11),
    column('takenBy', 'Taken By', 8),
    column('carriage', 'Carriage', 7.5, 'right'),
    column('prepaid', 'Amount Prepaid', 9, 'right'),
    column('courier', 'Courier', 9),
    column('lines', 'Lines', 5.5, 'right'),
    column('units', 'Units', 6, 'right'),
    column('unitsOutstanding', 'Units Outstanding', 9, 'right'),
    column('currency', 'Currency', 6.5, 'center'),
  ]) as Record<SageOrderColumnId, SageOrderColumnDef>

/** Width of the Action column (the View button), in rem. */
export const SAGE_ORDER_ACTION_COLUMN_REM = 5

/** The columns to draw, in order. */
export function shownSageOrderColumns(
  config: SageOrderColumnConfig,
): SageOrderColumnDef[] {
  return config.order
    .filter((id) => config.visible.includes(id))
    .map((id) => SAGE_ORDER_COLUMNS[id])
}

/** The table's least width in rem: the shown columns. */
export function sageOrderTableMinWidthRem(
  columns: readonly SageOrderColumnDef[],
): number {
  return columns.reduce(
    (total, shown) => total + shown.width,
    SAGE_ORDER_ACTION_COLUMN_REM,
  )
}
