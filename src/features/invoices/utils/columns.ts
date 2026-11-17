import type { ColumnConfig as BaseColumnConfig } from '../../../lib/columnConfig.ts'
import type { InvoiceSort } from '../../../lib/api/invoices.ts'

/**
 * The invoice table's columns. **Action** (View) is always last and is not part of the choice;
 * every other column can be shown, hidden and put in order from the Columns menu
 * (`components/ui/ColumnsMenu.tsx`, the one the Products table has). To begin with only the first
 * ten are shown, in this order; the rest are in the menu, hidden.
 */
export const INVOICE_COLUMN_IDS = [
  'customerOrder',
  'number',
  'date',
  'due',
  'customer',
  'kind',
  'net',
  'tax',
  'gross',
  'status',
  'salesOrder',
  'takenBy',
  'account',
  'paid',
  'outstanding',
] as const

export type InvoiceColumnId = (typeof INVOICE_COLUMN_IDS)[number]

export type InvoiceColumnConfig = BaseColumnConfig<InvoiceColumnId>

/** Shown to begin with, in this order, then Action. */
export const DEFAULT_VISIBLE_INVOICE_COLUMNS: InvoiceColumnId[] = [
  'number',
  'date',
  'due',
  'customer',
  'net',
  'tax',
  'gross',
  'status',
]

export interface InvoiceColumnDef {
  id: InvoiceColumnId
  label: string
  /** Width in rem (the table is fixed-layout). */
  width: number
  /** The heading and every cell of the column line up this way. */
  align: 'left' | 'center' | 'right'
  /** The API's `sort` value the heading's button applies, for the columns it can sort by. */
  sort?: InvoiceSort
}

const column = (
  id: InvoiceColumnId,
  label: string,
  width: number,
  align: InvoiceColumnDef['align'] = 'left',
  sort?: InvoiceSort,
): [InvoiceColumnId, InvoiceColumnDef] => [id, { id, label, width, align, sort }]

export const INVOICE_COLUMNS: Record<InvoiceColumnId, InvoiceColumnDef> =
  Object.fromEntries([
    column('customerOrder', 'Customer Order Number', 11),
    column('number', 'Invoice Number', 10, 'left', 'number'),
    column('date', 'Invoice Date', 8.5, 'left', 'date'),
    column('due', 'Due Date', 8.5, 'left', 'due_date'),
    column('customer', 'Customer', 16, 'left', 'customer'),
    column('kind', 'Invoice Type', 8.5),
    column('net', 'Net', 7.5, 'right'),
    column('tax', 'Tax', 7, 'right'),
    column('gross', 'Gross', 8, 'right', 'total'),
    column('status', 'Payment Status', 9.5, 'center'),
    column('salesOrder', 'Sales Order Number', 10),
    column('takenBy', 'Taken By', 8),
    column('account', 'Customer Account Reference', 11),
    column('paid', 'Paid Amount', 8, 'right'),
    column('outstanding', 'Outstanding Amount', 9.5, 'right', 'outstanding'),
  ]) as Record<InvoiceColumnId, InvoiceColumnDef>

/** Width of the Action column (the View button), in rem. */
export const INVOICE_ACTION_COLUMN_REM = 5

/** The columns to draw, in order. */
export function shownInvoiceColumns(config: InvoiceColumnConfig): InvoiceColumnDef[] {
  return config.order
    .filter((id) => config.visible.includes(id))
    .map((id) => INVOICE_COLUMNS[id])
}

/** The table's least width in rem: the shown columns and Action. */
export function invoiceTableMinWidthRem(columns: readonly InvoiceColumnDef[]): number {
  return columns.reduce((total, shown) => total + shown.width, INVOICE_ACTION_COLUMN_REM)
}
