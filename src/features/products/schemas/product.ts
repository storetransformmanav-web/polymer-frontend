import { z } from 'zod'

/**
 * The Product shape, as a runtime-checked schema — see the note in
 * features/orders/schemas/order.ts on why types are derived from the
 * schema rather than hand-written separately, and how to use this
 * once `getProducts()` calls a real backend.
 */
export const productCategorySchema = z.enum(['bags', 'cups', 'containers'])
export const productStatusSchema = z.enum(['active', 'draft', 'archived'])

export const productSchema = z.object({
  id: z.string(),
  title: z.string(),
  sku: z.string(),
  category: productCategorySchema,
  status: productStatusSchema,
  price: z.number(),
  currency: z.string(),
  inventory: z.number(),
})

export type ProductCategory = z.infer<typeof productCategorySchema>
export type ProductStatus = z.infer<typeof productStatusSchema>
export type Product = z.infer<typeof productSchema>
