import { z } from 'zod'
import { ApiError } from './ApiError.ts'
import { toNumber } from './invoices.ts'

/**
 * Sage 50 sales orders — `GET /api/sage/orders` (e.g. `?status=all&sort=number&order=desc&page=1&page_size=25`).
 * The shapes are the backend's documented ones; every field is read leniently (amounts arrive as text —
 * "169.5" — and become numbers, a missing or null field becomes empty) so one odd value never fails a
 * whole page. **Nothing here is data**: numbers, names, statuses and figures all come from the answer.
 */

/** The statuses the list can be narrowed to (the API's own `status` values; `all` is every order). */
export const SAGE_ORDER_STATUSES = [
  'all',
  'open',
  'part_allocated',
  'allocated',
  'part_despatched',
  'complete',
  'cancelled',
  'outstanding',
] as const
export type SageOrderStatus = (typeof SAGE_ORDER_STATUSES)[number]

/** What the list can be sorted by (the API's own `sort` values). */
export const SAGE_ORDER_SORTS = [
  'number',
  'date',
  'despatch_date',
  'total',
  'customer',
] as const
export type SageOrderSort = (typeof SAGE_ORDER_SORTS)[number]

export const SAGE_ORDER_MAX_PAGE_SIZE = 100

/** The query of `GET /api/sage/orders` (empty ones are left out). */
export type SageOrderListParams = Partial<Record<string, string | number | boolean>>

/**
 * How an export lays the orders out (the API's own `layout` values): `lines` is one row per order line
 * (the order's fields repeated), `orders` one row per order.
 */
export const SAGE_ORDER_EXPORT_LAYOUTS = ['lines', 'orders'] as const
export type SageOrderExportLayout = (typeof SAGE_ORDER_EXPORT_LAYOUTS)[number]

/** The query of `GET /api/sage/orders/export`: the list's own filters, without paging, and the `layout`. */
export type SageOrderExportParams = Partial<Record<string, string | number | boolean>>

const amount = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => toNumber(value))

const text = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) =>
    value === null || value === undefined ? '' : String(value).trim(),
  )

const date = text.transform((value) => value || null)

const orderSchema = z.object({
  order_number: text,
  order_date: date,
  /** `open`, `part_allocated`, `allocated`, `part_despatched`, `complete`, `cancelled`… */
  status: text,
  allocation_status: text,
  despatch_status: text,
  despatch_date: date,
  customer: z
    .object({ account_ref: text, name: text })
    .nullish()
    .transform((value) => value ?? { account_ref: '', name: '' }),
  delivery_name: text,
  contact_name: text,
  customer_order_number: text,
  taken_by: text,
  invoice_number: text,
  currency: text,
  net: amount,
  tax: amount,
  gross: amount,
  carriage_gross: amount,
  amount_prepaid: amount,
  courier: text,
  lines: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value) => toNumber(value)),
  units: amount,
  units_outstanding: amount,
})

export type SageOrder = z.output<typeof orderSchema>

const totalsSchema = z
  .object({
    orders: z.number().nullish(),
    net: amount,
    tax: amount,
    gross: amount,
  })
  .nullish()
  .transform((value) =>
    value
      ? {
          orders: value.orders ?? null,
          net: value.net,
          tax: value.tax,
          gross: value.gross,
        }
      : null,
  )

export type SageOrderTotals = NonNullable<z.output<typeof totalsSchema>>

const listResponseSchema = z
  .object({
    message: text,
    items: z.array(orderSchema),
    totals: totalsSchema,
    status_counts: z.record(z.string(), z.number()).nullish(),
    page: z.number().nullish(),
    page_size: z.number().nullish(),
    total: z.number().nullish(),
    total_pages: z.number().nullish(),
    has_next: z.boolean().nullish(),
    data_as_of: text,
  })
  .transform((data) => {
    const pageSize = data.page_size ?? (data.items.length || 25)
    const total = data.total ?? data.totals?.orders ?? data.items.length
    return {
      message: data.message,
      items: data.items,
      totals: data.totals,
      statusCounts: data.status_counts ?? {},
      page: data.page ?? 1,
      pageSize,
      total,
      totalPages:
        data.total_pages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
      hasNext: data.has_next ?? false,
      dataAsOf: data.data_as_of || null,
    }
  })

export type SageOrderListResponse = z.output<typeof listResponseSchema>

/** Checks the answer against its schema; one that doesn't fit fails with a message naming the part. */
export function readSageOrderList(data: unknown): SageOrderListResponse {
  const result = listResponseSchema.safeParse(data)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const where =
    issue && issue.path.length > 0 ? ` (${issue.path.join('.')}: ${issue.message})` : ''
  throw new ApiError(`The Sage orders answer was not in the expected form${where}.`)
}

// ------------------------------------------------------------------------------ one order

/**
 * A note or a comment as text: a plain string, or the text of an object (`text`, `note`, `message`…,
 * else its plain values joined). The API's notes are a list whose entries are not described, so a
 * shape that is not recognised still shows what it holds.
 */
function noteText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of ['text', 'note', 'message', 'comment', 'body', 'content']) {
      const found = record[key]
      if (typeof found === 'string' && found.trim()) return found.trim()
    }
    return Object.values(record)
      .filter((item) => typeof item === 'string' || typeof item === 'number')
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(' · ')
  }
  return ''
}

const noteList = z
  .array(z.unknown())
  .nullish()
  .transform((list) => (list ?? []).map(noteText).filter(Boolean))

const addressSchema = z
  .object({
    name: text,
    address_1: text,
    address_2: text,
    address_3: text,
    address_4: text,
    address_5: text,
    lines: z.array(text).nullish(),
  })
  .nullish()
  .transform((value) => {
    if (!value) return { lines: [] as string[] }
    // The API's own formatting when it sends one, else the name and the address lines in order.
    const own = (value.lines ?? []).filter(Boolean)
    const built = [
      value.name,
      value.address_1,
      value.address_2,
      value.address_3,
      value.address_4,
      value.address_5,
    ].filter(Boolean)
    return { lines: own.length > 0 ? own : built }
  })

const lineSchema = z.object({
  position: text,
  stock_code: text,
  /** A line of text only (a heading or a note): no product, no amounts. */
  is_text_line: z.boolean().nullish(),
  description: text,
  extra_text: text,
  comments: noteList,
  unit_of_sale: text,
  qty_ordered: amount,
  qty_allocated: amount,
  qty_despatched: amount,
  qty_outstanding: amount,
  qty_to_despatch: amount,
  unit_price: amount,
  discount_rate: amount,
  discount_amount: amount,
  net: amount,
  tax_code: text,
  tax_rate: amount,
  tax: amount,
  gross: amount,
  nominal_code: text,
  delivery_date: date,
  due_date: date,
  stock: z
    .object({ in_stock: amount, allocated: amount, free: amount, on_order: amount })
    .nullish(),
  product: z
    .object({
      product_id: text,
      handle: text,
      title: text,
      image_url: text,
    })
    .nullish(),
})

const amountsSchema = z
  .object({
    items_net: amount,
    items_tax: amount,
    items_gross: amount,
    discount_net: amount,
    discount_rate: amount,
    discount_description: text,
    carriage_net: amount,
    carriage_tax: amount,
    carriage_gross: amount,
    net: amount,
    tax: amount,
    gross: amount,
    amount_prepaid: amount,
    settlement_discount_rate: amount,
    settlement_due_days: amount,
    vat_analysis: z
      .array(z.object({ rate: amount, net: amount, tax: amount }))
      .nullish()
      .transform((rows) => rows ?? []),
  })
  .nullish()

const orderDetailSchema = z.object({
  order_number: text,
  order_date: date,
  created_at: date,
  updated_at: date,
  status: text,
  allocation_status: text,
  despatch_status: text,
  despatch_date: date,
  customer: z
    .object({ account_ref: text, name: text })
    .nullish()
    .transform((value) => value ?? { account_ref: '', name: '' }),
  crm_customer: z
    .object({
      id: text,
      name: text,
      email: text,
      orders_count: z.number().nullish(),
      total_spent: amount,
    })
    .nullish(),
  customer_order_number: text,
  taken_by: text,
  contact_name: text,
  telephone: text,
  vat_reg_number: text,
  currency: text,
  courier: text,
  consignment: text,
  payment_reference: text,
  notes: noteList,
  invoice_address: addressSchema,
  delivery_address: addressSchema,
  lines: z
    .array(lineSchema)
    .nullish()
    .transform((lines) => lines ?? []),
  amounts: amountsSchema,
  /** The invoices raised for the order. */
  invoices: z
    .array(
      z.object({
        invoice_number: text,
        invoice_date: date,
        gross: amount,
        outstanding: amount,
        payment_status: text,
      }),
    )
    .nullish()
    .transform((invoices) => invoices ?? []),
})

const detailResponseSchema = z.object({ order: orderDetailSchema })

export type SageOrderDetail = z.output<typeof orderDetailSchema>
export type SageOrderLine = SageOrderDetail['lines'][number]
export type SageOrderInvoice = SageOrderDetail['invoices'][number]

/** One order in full — the answer is `{ …, order: {…} }`; one that doesn't fit fails with a message naming the part. */
export function readSageOrderDetail(data: unknown): SageOrderDetail {
  const result = detailResponseSchema.safeParse(data)
  if (result.success) return result.data.order
  const issue = result.error.issues[0]
  const where =
    issue && issue.path.length > 0 ? ` (${issue.path.join('.')}: ${issue.message})` : ''
  throw new ApiError(`The Sage order answer was not in the expected form${where}.`)
}
