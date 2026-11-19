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
