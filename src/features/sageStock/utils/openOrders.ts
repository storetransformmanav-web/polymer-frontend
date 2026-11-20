import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import { toNumber } from '../../../lib/api/invoices.ts'

/**
 * One open sales order line of a stock item. The API describes no fields for `open_order_lines` beyond
 * the names below (its example is empty), so each value is looked for under the field's own name and a
 * few likely alternatives, ignoring letter case and `_`; a value that is not there is empty.
 */
export interface OpenOrderLine {
  orderNumber: string
  orderDate: string | null
  status: string
  accountRef: string
  customerName: string
  qtyOrdered: number | null
  qtyDespatched: number | null
  qtyOutstanding: number | null
  unitPrice: number | null
  net: number | null
}

const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const NAMES = {
  orderNumber: ['order_number', 'sales_order_number', 'order_no', 'order'],
  orderDate: ['order_date', 'date'],
  status: ['status', 'order_status'],
  accountRef: ['account_ref', 'account_reference', 'customer_ref', 'account'],
  customerName: ['customer_name', 'customer', 'name'],
  qtyOrdered: ['qty_ordered', 'quantity_ordered', 'qty'],
  qtyDespatched: ['qty_despatched', 'quantity_despatched', 'qty_dispatched'],
  qtyOutstanding: ['qty_outstanding', 'quantity_outstanding', 'outstanding'],
  unitPrice: ['unit_price', 'price'],
  net: ['net', 'net_amount', 'net_value'],
} as const

function pick(record: Record<string, unknown>, names: readonly string[]): unknown {
  const index = new Map<string, unknown>()
  for (const [key, value] of Object.entries(record)) index.set(norm(key), value)
  for (const name of names) {
    const value = index.get(norm(name))
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  // A customer sent as an object: its name.
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return text(pick(value as Record<string, unknown>, ['name', 'customer_name']))
  }
  return ''
}

/** The API's `open_order_lines` as typed lines. */
export function readOpenOrderLines(
  records: readonly Record<string, unknown>[],
): OpenOrderLine[] {
  return records.map((record) => ({
    orderNumber: text(pick(record, NAMES.orderNumber)),
    orderDate: text(pick(record, NAMES.orderDate)) || null,
    status: text(pick(record, NAMES.status)),
    accountRef: text(pick(record, NAMES.accountRef)),
    customerName: text(pick(record, NAMES.customerName)),
    qtyOrdered: toNumber(pick(record, NAMES.qtyOrdered)),
    qtyDespatched: toNumber(pick(record, NAMES.qtyDespatched)),
    qtyOutstanding: toNumber(pick(record, NAMES.qtyOutstanding)),
    unitPrice: toNumber(pick(record, NAMES.unitPrice)),
    net: toNumber(pick(record, NAMES.net)),
  }))
}

/** The sum of a quantity over the lines; null when none of them has it. */
export function sumOf(
  lines: readonly OpenOrderLine[],
  field: 'qtyOrdered' | 'qtyDespatched' | 'qtyOutstanding',
): number | null {
  let total: number | null = null
  for (const line of lines) {
    const value = line[field]
    if (value !== null) total = (total ?? 0) + value
  }
  return total
}

const STATUS_TONES: Record<string, BadgeTone> = {
  complete: 'success',
  completed: 'success',
  despatched: 'success',
  cancelled: 'danger',
  open: 'default',
  allocated: 'default',
  part_allocated: 'warning',
  part_despatched: 'warning',
  outstanding: 'warning',
}

/** An order line's status as a pill: the words the API sends, in colour for the usual ones. */
export function orderStatusPill(status: string): { label: string; tone: BadgeTone } {
  const key = status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  const words = key.replace(/_+/g, ' ').trim()
  return {
    label: words ? words.charAt(0).toUpperCase() + words.slice(1) : '—',
    tone: STATUS_TONES[key] ?? 'neutral',
  }
}
