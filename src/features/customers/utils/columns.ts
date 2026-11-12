import type { CustomerSort } from '../../../lib/api/endpoints.ts'
import {
  defaultColumnConfig as baseDefault,
  isDefaultColumnConfig as baseIsDefault,
  normalizeColumnConfig as baseNormalize,
  type ColumnConfig as BaseColumnConfig,
} from '../../../lib/columnConfig.ts'

/**
 * The customers table's columns. **Customer name** (always first) and **Actions** (always last)
 * are fixed; every other column is here, can be shown or hidden and put in any order from the
 * Columns menu (`CustomerColumnsMenu`). The pure rules live in this file so they can be tested.
 */
export const CUSTOMER_COLUMN_IDS = [
  'note',
  'email_subscription',
  'location',
  'orders',
  'amount_spent',
  'email',
  'phone',
  'first_name',
  'last_name',
  'postal_code',
  'language',
  'id',
  'added',
  'updated',
  'sms_subscription',
  'whatsapp_subscription',
  'tax_exempt',
  'deletable',
  'mergeable',
  'email_verified',
  'role',
  'shopify_state',
] as const

export type CustomerColumnId = (typeof CUSTOMER_COLUMN_IDS)[number]

export interface CustomerColumnDef {
  id: CustomerColumnId
  label: string
  /** Width in rem (the table is fixed-layout; the name column takes what is left). */
  width: number
  align: 'left' | 'center' | 'right'
  /** The API sort this column's header applies, when it has one. */
  sort?: CustomerSort
}

export const CUSTOMER_COLUMNS: Record<CustomerColumnId, CustomerColumnDef> = {
  note: { id: 'note', label: 'Note', width: 16, align: 'left' },
  email_subscription: {
    id: 'email_subscription',
    label: 'Email subscription',
    width: 11,
    align: 'center',
  },
  location: { id: 'location', label: 'Location', width: 13, align: 'left' },
  orders: {
    id: 'orders',
    label: 'Orders',
    width: 8,
    align: 'right',
    sort: 'orders_count',
  },
  amount_spent: {
    id: 'amount_spent',
    label: 'Amount spent',
    width: 10,
    align: 'right',
    sort: 'total_spent',
  },
  email: { id: 'email', label: 'Email', width: 18, align: 'left', sort: 'email' },
  phone: { id: 'phone', label: 'Phone', width: 11, align: 'left' },
  first_name: { id: 'first_name', label: 'First name', width: 10, align: 'left' },
  last_name: { id: 'last_name', label: 'Last name', width: 10, align: 'left' },
  postal_code: { id: 'postal_code', label: 'Postal code', width: 9, align: 'left' },
  language: { id: 'language', label: 'Customer language', width: 10, align: 'left' },
  id: { id: 'id', label: 'Id', width: 11, align: 'left' },
  added: {
    id: 'added',
    label: 'Customer added date',
    width: 11,
    align: 'center',
    sort: 'created_at',
  },
  updated: {
    id: 'updated',
    label: 'Date customer updated',
    width: 11,
    align: 'center',
    sort: 'updated_at',
  },
  sms_subscription: {
    id: 'sms_subscription',
    label: 'SMS subscription',
    width: 11,
    align: 'center',
  },
  whatsapp_subscription: {
    id: 'whatsapp_subscription',
    label: 'WhatsApp subscription',
    width: 12,
    align: 'center',
  },
  tax_exempt: { id: 'tax_exempt', label: 'Tax exempt', width: 8, align: 'center' },
  deletable: { id: 'deletable', label: 'Deletable', width: 8, align: 'center' },
  mergeable: { id: 'mergeable', label: 'Mergeable', width: 8, align: 'center' },
  email_verified: {
    id: 'email_verified',
    label: 'Email verified',
    width: 9,
    align: 'center',
  },
  role: { id: 'role', label: 'Role', width: 9, align: 'center' },
  shopify_state: {
    id: 'shopify_state',
    label: 'Shopify state',
    width: 9,
    align: 'center',
  },
}

/** Shown to begin with, in this order: Customer name, then these, then Actions. */
export const DEFAULT_VISIBLE_COLUMNS: CustomerColumnId[] = [
  'email',
  'email_subscription',
  'location',
  'orders',
  'amount_spent',
]

/** Width of the fixed columns, in rem: Customer name (at least) and Actions. */
export const NAME_COLUMN_MIN_REM = 16
export const ACTIONS_COLUMN_REM = 7

export type ColumnConfig = BaseColumnConfig<CustomerColumnId>

export const defaultColumnConfig = (): ColumnConfig =>
  baseDefault(CUSTOMER_COLUMN_IDS, DEFAULT_VISIBLE_COLUMNS)

/** Reads a saved choice defensively (see `lib/columnConfig.ts`). */
export const normalizeColumnConfig = (value: unknown): ColumnConfig =>
  baseNormalize(value, CUSTOMER_COLUMN_IDS, DEFAULT_VISIBLE_COLUMNS)

export const isDefaultColumnConfig = (config: ColumnConfig): boolean =>
  baseIsDefault(config, CUSTOMER_COLUMN_IDS, DEFAULT_VISIBLE_COLUMNS)

export { isColumnVisible, moveColumn, toggleColumn } from '../../../lib/columnConfig.ts'

/** The columns to draw, in order. */
export function shownColumns(config: ColumnConfig): CustomerColumnDef[] {
  return config.order
    .filter((id) => config.visible.includes(id))
    .map((id) => CUSTOMER_COLUMNS[id])
}

/** The table's least width in rem: the name, the shown columns and Actions. */
export function tableMinWidthRem(columns: CustomerColumnDef[]): number {
  return (
    NAME_COLUMN_MIN_REM +
    ACTIONS_COLUMN_REM +
    columns.reduce((total, column) => total + column.width, 0)
  )
}
