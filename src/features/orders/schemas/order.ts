import { z } from 'zod'

/**
 * The Order shape, as a runtime-checked schema. TS types below are
 * derived from it (`z.infer`) rather than hand-written separately, so
 * the static type and the runtime check can't drift apart.
 *
 * Today `mockOrders.ts` validates its own (already-typed) mock array
 * against this, which is a no-op in practice — but once `getOrders()`
 * calls a real backend, wrap that response in
 * `orderSchema.array().parse(response)` too: unlike the TS types, this
 * actually catches a shape mismatch from the network at runtime.
 */
export const customerTypeSchema = z.enum(['retail', 'wholesale'])
export const financialStatusSchema = z.enum(['paid', 'pending', 'refunded'])
export const fulfillmentStatusSchema = z.enum(['fulfilled', 'unfulfilled', 'partial'])

export const orderCustomerSchema = z.object({
  name: z.string(),
  type: customerTypeSchema,
})

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customer: orderCustomerSchema,
  createdAt: z.string(),
  financialStatus: financialStatusSchema,
  fulfillmentStatus: fulfillmentStatusSchema,
  lineItemCount: z.number(),
  total: z.number(),
  currency: z.string(),
})

export type CustomerType = z.infer<typeof customerTypeSchema>
export type FinancialStatus = z.infer<typeof financialStatusSchema>
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>
export type OrderCustomer = z.infer<typeof orderCustomerSchema>
export type Order = z.infer<typeof orderSchema>
