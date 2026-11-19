import type { ColumnConfig as BaseColumnConfig } from '../../../lib/columnConfig.ts'
import type { SageCustomerSort } from '../../../lib/api/sageCustomers.ts'

/**
 * The Sage customers table's columns. **Action** (View) is always last and is not part of the
 * choice; every other column can be shown, hidden and put in order from the Columns menu
 * (`components/ui/ColumnsMenu.tsx`). Only what the list answer carries is a column.
 */
export const SAGE_CUSTOMER_COLUMN_IDS = [
  'account',
  'name',
  'contact',
  'email',
  'orders',
  'telephone',
  'postcode',
  'country',
  'currency',
  'balance',
  'creditLimit',
  'availableCredit',
  'status',
  'turnoverMtd',
  'turnoverYtd',
  'turnoverPrior',
  'firstInvoice',
  'lastInvoice',
  'lastPayment',
  'opened',
  'pricing',
  'crm',
] as const

export type SageCustomerColumnId = (typeof SAGE_CUSTOMER_COLUMN_IDS)[number]

export type SageCustomerColumnConfig = BaseColumnConfig<SageCustomerColumnId>

/** Shown to begin with, in this order, then Action. */
export const DEFAULT_VISIBLE_SAGE_CUSTOMER_COLUMNS: SageCustomerColumnId[] = [
  'account',
  'name',
  'email',
  'orders',
  'balance',
  'creditLimit',
  'lastInvoice',
  'status',
]

export interface SageCustomerColumnDef {
  id: SageCustomerColumnId
  label: string
  /** Width in rem (the table is fixed-layout). */
  width: number
  /** The heading and every cell of the column line up this way. */
  align: 'left' | 'center' | 'right'
  /** The API's `sort` value the heading's button applies, for the columns it can sort by. */
  sort?: SageCustomerSort
}

const column = (
  id: SageCustomerColumnId,
  label: string,
  width: number,
  align: SageCustomerColumnDef['align'] = 'left',
  sort?: SageCustomerSort,
): [SageCustomerColumnId, SageCustomerColumnDef] => [
  id,
  { id, label, width, align, sort },
]

export const SAGE_CUSTOMER_COLUMNS: Record<SageCustomerColumnId, SageCustomerColumnDef> =
  Object.fromEntries([
    column('account', 'Account Ref', 8, 'left', 'account_ref'),
    column('name', 'Customer', 17, 'left', 'name'),
    column('contact', 'Contact', 11),
    column('email', 'Email', 14),
    column('orders', 'CRM Orders', 7.5, 'right'),
    column('telephone', 'Telephone', 9.5),
    column('postcode', 'Postcode', 7.5),
    column('country', 'Country', 6.5, 'center'),
    column('currency', 'Currency', 6.5, 'center'),
    column('balance', 'Balance', 8.5, 'right', 'balance'),
    column('creditLimit', 'Credit Limit', 8.5, 'right', 'credit_limit'),
    column('availableCredit', 'Available Credit', 9, 'right'),
    column('status', 'Status', 8, 'center'),
    column('turnoverMtd', 'Turnover MTD', 9, 'right'),
    column('turnoverYtd', 'Turnover YTD', 9, 'right', 'turnover_ytd'),
    column('turnoverPrior', 'Turnover Prior Year', 9.5, 'right'),
    column('firstInvoice', 'First Invoice', 8.5),
    column('lastInvoice', 'Last Invoice', 8.5, 'left', 'last_invoice_date'),
    column('lastPayment', 'Last Payment', 8.5, 'left', 'last_payment_date'),
    column('opened', 'Opened On', 8.5, 'left', 'opened_on'),
    column('pricing', 'Pricing Ref', 9),
    column('crm', 'CRM Customer', 14),
  ]) as Record<SageCustomerColumnId, SageCustomerColumnDef>

/** Width of the Action column (the View button), in rem. */
export const SAGE_CUSTOMER_ACTION_COLUMN_REM = 5

/** The columns to draw, in order. */
export function shownSageCustomerColumns(
  config: SageCustomerColumnConfig,
): SageCustomerColumnDef[] {
  return config.order
    .filter((id) => config.visible.includes(id))
    .map((id) => SAGE_CUSTOMER_COLUMNS[id])
}

/** The table's least width in rem: the shown columns and Action. */
export function sageCustomerTableMinWidthRem(
  columns: readonly SageCustomerColumnDef[],
): number {
  return columns.reduce(
    (total, shown) => total + shown.width,
    SAGE_CUSTOMER_ACTION_COLUMN_REM,
  )
}
