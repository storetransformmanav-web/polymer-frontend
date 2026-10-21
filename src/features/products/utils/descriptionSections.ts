import { z } from 'zod'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'

/**
 * Some stores keep the description as sections (Product Description, Product
 * Information…) shown as an accordion on the shop's product page, made by a
 * description app that saves them in a product metafield — namespace `apd`, key
 * `apd`, a JSON string. This reads those sections so the CRM can show them the same way.
 */

const NAMESPACE = 'apd'
const KEY = 'apd'

const settingsSchema = z.object({
  /** false: opening one section closes the others. */
  accordian_multi: z.boolean().optional(),
  sections: z.array(
    z.object({
      title: z.string().nullish(),
      content: z.string().nullish(),
      position: z.number().nullish(),
    }),
  ),
})

export interface DescriptionSection {
  title: string
  /** HTML — shown only through `SafeHtml`. */
  content: string
}

export interface DescriptionSections {
  sections: DescriptionSection[]
  /** Can several sections be open at once? */
  multi: boolean
}

/**
 * The product's description sections from its `apd` metafield, in their saved order —
 * or null when it has none (no metafield, text that isn't the expected JSON, or no
 * section with a title).
 */
export function readDescriptionSections(
  product: Pick<ProductDetail, 'metafields'> | null | undefined,
): DescriptionSections | null {
  const field = product?.metafields.find(
    (item) => item.namespace === NAMESPACE && item.key === KEY,
  )
  if (!field?.value) return null

  let json: unknown
  try {
    json = JSON.parse(field.value)
  } catch {
    return null
  }
  const parsed = settingsSchema.safeParse(json)
  if (!parsed.success) return null

  const sections = parsed.data.sections
    .map((section, index) => ({
      index,
      position: section.position ?? index,
      title: (section.title ?? '').trim(),
      content: section.content ?? '',
    }))
    .filter((section) => section.title !== '')
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map(({ title, content }) => ({ title, content }))

  return sections.length > 0
    ? { sections, multi: parsed.data.accordian_multi ?? true }
    : null
}
