/**
 * `GET /products/sales/overview` — the product sales dashboard behind the Analytics page: totals
 * compared with the period straight before, the stock-level split, the best / lowest / unsold
 * products and the trend. The request function is `api.products.salesOverview` in `endpoints.ts`.
 *
 * Money arrives as text ("181077.89") and becomes a number here.
 */
import { z } from 'zod'

const amount = z.coerce.number()
const optionalNumber = z.number().nullish()
const optionalText = z.string().nullish()

const productSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: optionalText,
  status: optionalText,
  image_url: optionalText,
  total_inventory: optionalNumber,
  last_sold_on: optionalText,
})

/** A product of the best or lowest list: it sold something in the period. */
const soldProductSchema = productSchema.extend({
  units_sold: z.number(),
  revenue: amount,
  orders: z.number(),
  share_percent: optionalNumber,
  rank: optionalNumber,
  level: optionalText,
  /** The backend's own words for the level ("Top seller", "Low seller"). */
  label: optionalText,
})

const trendPointSchema = z.object({
  period_start: z.string(),
  units_sold: z.number(),
  revenue: amount,
  orders: z.number(),
})

const overviewSchema = z.object({
  period: z.object({
    date_from: z.string(),
    date_to: z.string(),
    days: optionalNumber,
    previous_from: optionalText,
    previous_to: optionalText,
    group_by: optionalText,
  }),
  currency: z.string().nullish(),
  totals: z.object({
    units_sold: z.number(),
    revenue: amount,
    orders: z.number(),
    average_order_value: amount.nullish(),
    products_sold: optionalNumber,
    units_change_percent: optionalNumber,
    revenue_change_percent: optionalNumber,
    orders_change_percent: optionalNumber,
  }),
  levels: z.object({
    top: z.number(),
    good: z.number(),
    low: z.number(),
    none: z.number(),
    none_active: optionalNumber,
  }),
  top_products: z.array(soldProductSchema),
  low_products: z.array(soldProductSchema),
  unsold_products: z.array(productSchema),
  trend: z.array(trendPointSchema),
})

const responseSchema = z.object({
  message: z.string().nullish(),
  overview: overviewSchema,
})

export type SalesOverview = z.infer<typeof overviewSchema>
export type SalesTrendPoint = z.infer<typeof trendPointSchema>
export type SoldProduct = z.infer<typeof soldProductSchema>
export type SalesProduct = z.infer<typeof productSchema>

export interface SalesOverviewParams {
  /** Chart points: day / week / month; `auto` lets the backend choose. */
  group_by: 'auto' | 'day' | 'week' | 'month'
  /** How many products in each list (1–50). */
  top: number
  /** First and last day of a fixed period; left out, the backend uses its own default period. */
  date_from?: string
  date_to?: string
  /** One store's key or domain; left out for every store. */
  shop?: string
}

export function readSalesOverview(data: unknown): SalesOverview {
  return responseSchema.parse(data).overview
}
