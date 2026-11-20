import { z } from 'zod'
import { ApiError } from './ApiError.ts'
import { toNumber } from './invoices.ts'

/**
 * Sage 50 stock — `GET /api/sage/stock` (e.g. `?tab=all&sort=stock_code&order=asc&page=1&page_size=25`).
 * The shapes are the backend's documented ones; every field is read leniently (amounts arrive as text —
 * "60.0" — and become numbers, a missing or null field becomes empty) so one odd value never fails a
 * whole page. **Nothing here is data**: codes, names, quantities, statuses and figures all come from the
 * answer.
 */

/** The stock statuses the list can be narrowed to (the API's own `tab` values; `all` is every item). */
export const SAGE_STOCK_TABS = [
  'all',
  'in_stock',
  'low_stock',
  'out_of_stock',
  'not_tracked',
  'inactive',
] as const
export type SageStockTab = (typeof SAGE_STOCK_TABS)[number]

/** What the list can be sorted by (the API's own `sort` values). */
export const SAGE_STOCK_SORTS = [
  'stock_code',
  'description',
  'category',
  'qty_in_stock',
  'qty_free',
  'sales_price',
  'stock_value',
  'sales_ytd',
  'qty_sold_ytd',
  'last_sale_date',
  'margin_percent',
] as const
export type SageStockSort = (typeof SAGE_STOCK_SORTS)[number]

export const SAGE_STOCK_MAX_PAGE_SIZE = 100

/** The query of `GET /api/sage/stock` (empty ones are left out). */
export type SageStockListParams = Partial<Record<string, string | number | boolean>>

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

const itemSchema = z.object({
  stock_code: text,
  description: text,
  category: text,
  unit_of_sale: text,
  sales_price: amount,
  average_cost: amount,
  last_purchase_price: amount,
  margin_percent: amount,
  qty_in_stock: amount,
  qty_allocated: amount,
  qty_free: amount,
  qty_on_order: amount,
  reorder_level: amount,
  reorder_qty: amount,
  /** `in_stock`, `low_stock`, `out_of_stock`, `not_tracked`, `inactive`… */
  stock_status: text,
  stock_value: amount,
  qty_sold_ytd: amount,
  sales_ytd: amount,
  last_sale_date: date,
  last_purchase_date: date,
  supplier_ref: text,
  supplier_part_number: text,
  barcode: text,
  location: text,
  tax_code: text,
  web_published: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
  inactive: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
  /** The CRM / Shopify variant that has this SKU; null for a Sage-only item. */
  shopify: z
    .object({
      product_id: text,
      variant_id: text,
      title: text,
      variant_title: text,
      handle: text,
      sku: text,
      price: amount,
      inventory_quantity: amount,
      image_url: text,
    })
    .nullish()
    .transform((value) => value ?? null),
})

export type SageStockItem = z.output<typeof itemSchema>

const totalsSchema = z
  .object({
    items: z.number().nullish(),
    qty_in_stock: amount,
    stock_value: amount,
    sales_value: amount,
    sales_ytd: amount,
  })
  .nullish()
  .transform((value) =>
    value
      ? {
          items: value.items ?? null,
          qtyInStock: value.qty_in_stock,
          stockValue: value.stock_value,
          salesValue: value.sales_value,
          salesYtd: value.sales_ytd,
        }
      : null,
  )

export type SageStockTotals = NonNullable<z.output<typeof totalsSchema>>

const listResponseSchema = z
  .object({
    message: text,
    items: z.array(itemSchema),
    totals: totalsSchema,
    tab_counts: z.record(z.string(), z.number()).nullish(),
    page: z.number().nullish(),
    page_size: z.number().nullish(),
    total: z.number().nullish(),
    total_pages: z.number().nullish(),
    has_next: z.boolean().nullish(),
    data_as_of: text,
  })
  .transform((data) => {
    const pageSize = data.page_size ?? (data.items.length || 25)
    const total = data.total ?? data.totals?.items ?? data.items.length
    return {
      message: data.message,
      items: data.items,
      totals: data.totals,
      tabCounts: data.tab_counts ?? {},
      page: data.page ?? 1,
      pageSize,
      total,
      totalPages:
        data.total_pages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
      hasNext: data.has_next ?? false,
      dataAsOf: data.data_as_of || null,
    }
  })

export type SageStockListResponse = z.output<typeof listResponseSchema>

/** Checks the answer against its schema; one that doesn't fit fails with a message naming the part. */
export function readSageStockList(data: unknown): SageStockListResponse {
  const result = listResponseSchema.safeParse(data)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const where =
    issue && issue.path.length > 0 ? ` (${issue.path.join('.')}: ${issue.message})` : ''
  throw new ApiError(`The Sage stock answer was not in the expected form${where}.`)
}
