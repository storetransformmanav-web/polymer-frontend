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

/**
 * The query of `GET /api/sage/stock/export`: the list's own filters, without paging — or `stock_codes`
 * (the chosen items, comma-separated, up to 2000).
 */
export type SageStockExportParams = Partial<Record<string, string | number | boolean>>

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

// ---------------------------------------------------------------------------- one stock item

/** A free-form record the API describes no fields for (discount bands, open order lines): its plain values are shown as they come. */
const looseRecords = z
  .array(z.record(z.string(), z.unknown()))
  .nullish()
  .transform((rows) => rows ?? [])

const detailItemSchema = z.object({
  stock_code: text,
  description: text,
  category: text,
  category_number: text,
  unit_of_sale: text,
  unit_weight: amount,
  barcode: text,
  location: text,
  commodity_code: text,
  country_of_origin: text,
  nominal_code: text,
  purchase_nominal_code: text,
  tax_code: text,
  department: text,
  inactive: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
  /** `in_stock`, `low_stock`, `out_of_stock`, `not_tracked`, `inactive`… */
  stock_status: text,
  supplier_ref: text,
  supplier_part_number: text,
  sales_price: amount,
  average_cost: amount,
  last_purchase_price: amount,
  margin_percent: amount,
  stock: z
    .object({ in_stock: amount, allocated: amount, free: amount, on_order: amount })
    .nullish(),
  reorder_level: amount,
  reorder_qty: amount,
  stock_value: amount,
  last_stock_take_date: date,
  qty_last_stock_take: amount,
  last_sale_date: date,
  last_purchase_date: date,
  qty_sold_ytd: amount,
  sales_ytd: amount,
  cost_ytd: amount,
  financial_year_start: date,
  /** This financial year's months, each with the same month a year earlier. */
  months: z
    .array(
      z.object({
        month: text,
        period: z.number().nullish(),
        qty_sold: amount,
        sales: amount,
        cost: amount,
        prior_year_qty_sold: amount,
        prior_year_sales: amount,
        prior_year_cost: amount,
      }),
    )
    .nullish()
    .transform((rows) => rows ?? []),
  discount_bands: looseRecords,
  price_lists: z
    .array(
      z.object({
        pricing_ref: text,
        name: text,
        currency: text,
        calculation_method: text,
        calculation_value: amount,
        price: amount,
        customers: z.number().nullish(),
      }),
    )
    .nullish()
    .transform((rows) => rows ?? []),
  open_order_lines: looseRecords,
  web: z
    .object({
      published: z.boolean().nullish(),
      special_offer: z.boolean().nullish(),
      description: text,
      details: text,
      category_1: text,
      category_2: text,
      category_3: text,
    })
    .nullish(),
  /** Every CRM / Shopify variant that has this SKU. */
  shopify: z
    .array(
      z.object({
        product_id: text,
        variant_id: text,
        title: text,
        variant_title: text,
        handle: text,
        sku: text,
        price: amount,
        inventory_quantity: amount,
        image_url: text,
      }),
    )
    .nullish()
    .transform((rows) => rows ?? []),
  created_at: date,
  updated_at: date,
  data_as_of: date,
})

const detailResponseSchema = z.object({ item: detailItemSchema })

export type SageStockDetail = z.output<typeof detailItemSchema>
export type SageStockMonth = SageStockDetail['months'][number]
export type SageStockPriceList = SageStockDetail['price_lists'][number]
export type SageStockShopifyVariant = SageStockDetail['shopify'][number]

/** One stock item in full — the answer is `{ …, item: {…} }`; one that doesn't fit fails with a message naming the part. */
export function readSageStockDetail(data: unknown): SageStockDetail {
  const result = detailResponseSchema.safeParse(data)
  if (result.success) return result.data.item
  const issue = result.error.issues[0]
  const where =
    issue && issue.path.length > 0 ? ` (${issue.path.join('.')}: ${issue.message})` : ''
  throw new ApiError(`The Sage stock item answer was not in the expected form${where}.`)
}
