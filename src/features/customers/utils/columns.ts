import type { CustomerSort } from '../../../lib/api/endpoints.ts'

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

export interface ColumnConfig {
  /** Every column, in the order the menu lists them and the table shows the visible ones. */
  order: CustomerColumnId[]
  visible: CustomerColumnId[]
}

const KNOWN = new Set<string>(CUSTOMER_COLUMN_IDS)
const isColumnId = (value: unknown): value is CustomerColumnId =>
  typeof value === 'string' && KNOWN.has(value)

export function defaultColumnConfig(): ColumnConfig {
  const hidden = CUSTOMER_COLUMN_IDS.filter((id) => !DEFAULT_VISIBLE_COLUMNS.includes(id))
  return {
    order: [...DEFAULT_VISIBLE_COLUMNS, ...hidden],
    visible: [...DEFAULT_VISIBLE_COLUMNS],
  }
}

/**
 * Reads a saved configuration (it comes from storage, so it may be anything): unknown or repeated
 * names are dropped and a column the saved copy doesn't know yet is added at the end, hidden.
 * Anything unusable gives the default.
 */
export function normalizeColumnConfig(value: unknown): ColumnConfig {
  if (typeof value !== 'object' || value === null) return defaultColumnConfig()
  const { order, visible } = value as { order?: unknown; visible?: unknown }
  if (!Array.isArray(order) || !Array.isArray(visible)) return defaultColumnConfig()

  const seen = new Set<CustomerColumnId>()
  const cleanOrder: CustomerColumnId[] = []
  for (const id of order) {
    if (isColumnId(id) && !seen.has(id)) {
      seen.add(id)
      cleanOrder.push(id)
    }
  }
  for (const id of CUSTOMER_COLUMN_IDS) if (!seen.has(id)) cleanOrder.push(id)

  const shown = new Set(visible.filter(isColumnId))
  return { order: cleanOrder, visible: cleanOrder.filter((id) => shown.has(id)) }
}

/** Is this the default choice (the same columns, in the same order)? */
export function isDefaultColumnConfig(config: ColumnConfig): boolean {
  const defaults = defaultColumnConfig()
  const same = (a: CustomerColumnId[], b: CustomerColumnId[]) =>
    a.length === b.length && a.every((id, index) => id === b[index])
  return same(config.order, defaults.order) && same(config.visible, defaults.visible)
}

export function isColumnVisible(config: ColumnConfig, id: CustomerColumnId): boolean {
  return config.visible.includes(id)
}

/** Show a hidden column or hide a shown one. */
export function toggleColumn(config: ColumnConfig, id: CustomerColumnId): ColumnConfig {
  const visible = isColumnVisible(config, id)
    ? config.visible.filter((item) => item !== id)
    : config.order.filter((item) => item === id || config.visible.includes(item))
  return { order: config.order, visible }
}

/** Puts `id` where `target` is (the others shift); an unknown name or the same one changes nothing. */
export function moveColumn(
  config: ColumnConfig,
  id: CustomerColumnId,
  target: CustomerColumnId,
): ColumnConfig {
  const from = config.order.indexOf(id)
  const to = config.order.indexOf(target)
  if (from < 0 || to < 0 || from === to) return config
  const order = [...config.order]
  order.splice(from, 1)
  order.splice(to, 0, id)
  return { order, visible: order.filter((item) => config.visible.includes(item)) }
}

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
