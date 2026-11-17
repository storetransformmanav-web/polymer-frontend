import { ApiError } from './ApiError.ts'

/**
 * Sage 50 invoices — `GET /api/sage/invoices` (e.g. `?kind=all&sort=number&order=desc&page=1&page_size=25`). The request's parameters and the answer's shape come
 * from the page's brief, **not from a published spec** (the API's documentation is not readable
 * from here), so the answer is read leniently: each value is looked for under the names the
 * backend is likely to use (`invoice_number` / `number`, `net_amount` / `net`…), amounts may be
 * numbers or text, and `kind_counts` may be an object or a list. If a name turns out to differ,
 * add it to the lists below (the answers) or to `INVOICE_PARAM` (the request) — nothing else
 * depends on the spelling. Check the real answer in the Network tab.
 */

/** The document types the filter offers; the value is what is sent as the type filter. */
export const INVOICE_KINDS = ['invoice', 'credit_note', 'quotation', 'proforma'] as const
export type InvoiceKind = (typeof INVOICE_KINDS)[number]

export const INVOICE_PAYMENT_STATUSES = [
  'paid',
  'part_paid',
  'unpaid',
  'overdue',
  'not_posted',
] as const
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number]

/** What the list can be sorted by (the API's own `sort` values). */
export const INVOICE_SORTS = [
  'number',
  'date',
  'due_date',
  'total',
  'outstanding',
  'customer',
] as const
export type InvoiceSort = (typeof INVOICE_SORTS)[number]

/** The type filter's value for "every document type" (the API's own default). */
export const INVOICE_KIND_ALL = 'all'

/** The most records the API gives in one page. */
export const INVOICE_MAX_PAGE_SIZE = 100

/** The query parameter names (one place to change if the backend spells one differently). */
export const INVOICE_PARAM = {
  kind: 'kind',
  search: 'search',
  accountRef: 'account_ref',
  paymentStatus: 'payment_status',
  takenBy: 'taken_by',
  from: 'date_from',
  to: 'date_to',
  minTotal: 'min_total',
  maxTotal: 'max_total',
  sort: 'sort',
  order: 'order',
  page: 'page',
  pageSize: 'page_size',
} as const

export type InvoiceListParams = Partial<Record<string, string | number>>

export interface Invoice {
  /** A stable key for the row. */
  id: string
  number: string
  salesOrderNumber: string
  /** The document type as the API names it, lower case with underscores ("credit_note"). */
  kind: string
  /** "2026-11-10" or a full timestamp, as sent. */
  date: string | null
  dueDate: string | null
  customerName: string
  accountRef: string
  customerOrderNumber: string
  takenBy: string
  net: number | null
  tax: number | null
  gross: number | null
  paid: number | null
  outstanding: number | null
  /** As the API names it, lower case with underscores ("part_paid"). */
  paymentStatus: string
  currency: string | null
}

export interface InvoiceTotals {
  invoices: number | null
  net: number | null
  tax: number | null
  gross: number | null
  paid: number | null
  outstanding: number | null
  overdue: number | null
}

export interface InvoiceKindCount {
  kind: string
  count: number
}

export interface InvoiceListResponse {
  items: Invoice[]
  /** The figures for everything the filters match — not just this page; null when not sent. */
  totals: InvoiceTotals | null
  kindCounts: InvoiceKindCount[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
}

type Raw = Record<string, unknown>

const isRaw = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The first present value among these names (an empty string or null does not count). */
function pick(raw: Raw, names: readonly string[]): unknown {
  for (const name of names) {
    const value = raw[name]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** A number from a number or a numeric text ("1,234.50" too); null when it is neither. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const cleaned = value.replace(/[£$€,\s]/g, '')
    if (cleaned === '') return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** "Part Paid" / "part-paid" → "part_paid": the same word however the API writes it. */
export function canonicalKey(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

const NAMES = {
  id: ['id', 'invoice_id', 'uuid'],
  number: [
    'invoice_number',
    'invoice_no',
    'number',
    'document_number',
    'doc_number',
    'invoice_ref',
  ],
  salesOrder: ['sales_order_number', 'sales_order_no', 'sop_number', 'sales_order'],
  kind: ['kind', 'document_type', 'doc_type', 'document_kind', 'type'],
  date: ['invoice_date', 'date', 'document_date', 'tax_date'],
  dueDate: ['due_date', 'date_due', 'payment_due_date'],
  accountRef: [
    'customer_account_ref',
    'account_ref',
    'account_reference',
    'customer_ref',
    'account_number',
  ],
  customerOrder: [
    'customer_order_number',
    'customer_order_no',
    'cust_order_no',
    'customer_order_ref',
    'customer_order',
  ],
  takenBy: ['taken_by', 'taken_by_name', 'created_by'],
  net: ['net_amount', 'net_total', 'net', 'goods_total'],
  tax: ['tax_amount', 'tax_total', 'vat_amount', 'tax', 'vat'],
  gross: ['gross_amount', 'gross_total', 'total_amount', 'gross', 'total'],
  paid: ['paid_amount', 'amount_paid', 'paid'],
  outstanding: ['outstanding_amount', 'amount_outstanding', 'outstanding', 'balance'],
  status: ['payment_status', 'paid_status', 'status'],
  currency: ['currency', 'currency_code'],
} as const

export function readInvoice(raw: Raw, index = 0): Invoice {
  // The customer may be one object ({ name, account_ref }) instead of flat fields.
  const customer = isRaw(raw.customer) ? raw.customer : null
  const customerName =
    text(pick(raw, ['customer_name', 'account_name'])) ||
    (customer
      ? text(pick(customer, ['name', 'customer_name', 'account_name']))
      : text(pick(raw, ['customer', 'name'])))
  const accountRef =
    text(pick(raw, NAMES.accountRef)) ||
    (customer ? text(pick(customer, NAMES.accountRef)) : '')
  const number = text(pick(raw, NAMES.number))
  const kind = canonicalKey(pick(raw, NAMES.kind))
  const id = text(pick(raw, NAMES.id)) || `${kind || 'doc'}-${number || index}`
  return {
    id,
    number,
    salesOrderNumber: text(pick(raw, NAMES.salesOrder)),
    kind,
    date: text(pick(raw, NAMES.date)) || null,
    dueDate: text(pick(raw, NAMES.dueDate)) || null,
    customerName,
    accountRef,
    customerOrderNumber: text(pick(raw, NAMES.customerOrder)),
    takenBy: text(pick(raw, NAMES.takenBy)),
    net: toNumber(pick(raw, NAMES.net)),
    tax: toNumber(pick(raw, NAMES.tax)),
    gross: toNumber(pick(raw, NAMES.gross)),
    paid: toNumber(pick(raw, NAMES.paid)),
    outstanding: toNumber(pick(raw, NAMES.outstanding)),
    paymentStatus: canonicalKey(pick(raw, NAMES.status)),
    currency: text(pick(raw, NAMES.currency)) || null,
  }
}

const TOTAL_NAMES = {
  invoices: ['invoices', 'invoice_count', 'total_invoices', 'count'],
  net: ['net_amount', 'net_total', 'net'],
  tax: ['tax_amount', 'tax_total', 'tax', 'vat'],
  gross: ['gross_amount', 'gross_total', 'gross', 'total'],
  paid: ['paid_amount', 'paid'],
  outstanding: ['outstanding_amount', 'outstanding'],
  overdue: ['overdue_invoices', 'overdue_count', 'overdue_invoice_count', 'overdue'],
} as const

function readTotals(value: unknown): InvoiceTotals | null {
  if (!isRaw(value)) return null
  return {
    invoices: toNumber(pick(value, TOTAL_NAMES.invoices)),
    net: toNumber(pick(value, TOTAL_NAMES.net)),
    tax: toNumber(pick(value, TOTAL_NAMES.tax)),
    gross: toNumber(pick(value, TOTAL_NAMES.gross)),
    paid: toNumber(pick(value, TOTAL_NAMES.paid)),
    outstanding: toNumber(pick(value, TOTAL_NAMES.outstanding)),
    overdue: toNumber(pick(value, TOTAL_NAMES.overdue)),
  }
}

/** `kind_counts` as `{ invoice: 12, credit_note: 3 }` or `[{ kind, count }]`. */
function readKindCounts(value: unknown): InvoiceKindCount[] {
  const found: InvoiceKindCount[] = []
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRaw(entry)) continue
      const kind = canonicalKey(pick(entry, ['kind', 'document_type', 'type', 'name']))
      const count = toNumber(pick(entry, ['count', 'total', 'invoices']))
      if (kind && count !== null) found.push({ kind, count })
    }
  } else if (isRaw(value)) {
    for (const [key, count] of Object.entries(value)) {
      const number = toNumber(count)
      if (number !== null) found.push({ kind: canonicalKey(key), count: number })
    }
  }
  return found
}

/** The whole answer. An answer with no list of invoices in it is refused with a readable message. */
export function readInvoiceList(data: unknown): InvoiceListResponse {
  if (!isRaw(data)) {
    throw new ApiError('The invoices answer was not in the expected form.')
  }
  const list = [data.items, data.invoices, data.data, data.results].find(
    Array.isArray,
  ) as unknown[] | undefined
  if (!list) {
    throw new ApiError('The invoices answer was not in the expected form (no items).')
  }
  const items = list.filter(isRaw).map((raw, index) => readInvoice(raw, index))
  const paging = isRaw(data.pagination) ? data.pagination : data
  const totals = readTotals(data.totals)
  const page = toNumber(paging.page) ?? 1
  const pageSize = toNumber(paging.page_size) ?? (items.length || 25)
  const total = toNumber(paging.total) ?? totals?.invoices ?? items.length
  const totalPages =
    toNumber(paging.total_pages) ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const hasNext =
    typeof paging.has_next === 'boolean' ? paging.has_next : page < totalPages
  return {
    items,
    totals,
    kindCounts: readKindCounts(data.kind_counts),
    page,
    pageSize,
    total,
    totalPages,
    hasNext,
  }
}
