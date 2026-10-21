import { z } from 'zod'
import type { ProductDetail, ProductMetafieldInput } from '../../../lib/api/endpoints.ts'

/**
 * Some stores keep the description as sections (Product Description, Product
 * Information…) shown as an accordion on the shop's product page, made by a
 * description app that saves them in a product metafield — namespace `apd`, key
 * `apd`, a JSON string. This reads those sections so the CRM can show them the same
 * way, and writes them back (`metafields` of `PUT /products/{id}`) when they are edited.
 */

export const APD_NAMESPACE = 'apd'
export const APD_KEY = 'apd'
/** Shopify's limit for a JSON metafield value. */
export const APD_MAX_LENGTH = 2_000_000
export const SECTION_TITLE_MAX = 255

const settingsSchema = z.looseObject({
  /** false: opening one section closes the others. */
  accordian_multi: z.boolean().optional(),
  sections: z.array(
    z.looseObject({
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

/** The metafield as saved: its type, every setting in it, and each section as saved. */
interface ParsedApd {
  type: string
  settings: Record<string, unknown>
  sections: {
    source: Record<string, unknown>
    title: string
    content: string
    position: number
    index: number
  }[]
}

function parseApd(
  product: Pick<ProductDetail, 'metafields'> | null | undefined,
): ParsedApd | null {
  const field = product?.metafields.find(
    (item) => item.namespace === APD_NAMESPACE && item.key === APD_KEY,
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

  return {
    type: field.type || 'json_string',
    settings: parsed.data,
    sections: parsed.data.sections
      .map((section, index) => ({
        source: section,
        index,
        position: section.position ?? index,
        title: (section.title ?? '').trim(),
        content: section.content ?? '',
      }))
      .filter((section) => section.title !== '')
      .sort((a, b) => a.position - b.position || a.index - b.index),
  }
}

/**
 * The product's description sections from its `apd` metafield, in their saved order —
 * or null when it has none (no metafield, text that isn't the expected JSON, or no
 * section with a title).
 */
export function readDescriptionSections(
  product: Pick<ProductDetail, 'metafields'> | null | undefined,
): DescriptionSections | null {
  const apd = parseApd(product)
  if (!apd || apd.sections.length === 0) return null
  return {
    sections: apd.sections.map(({ title, content }) => ({ title, content })),
    multi:
      typeof apd.settings.accordian_multi === 'boolean'
        ? apd.settings.accordian_multi
        : true,
  }
}

// --- Editing -----------------------------------------------------------------------

/** One section in the editor. */
export interface SectionDraft {
  /** Stable React key. */
  key: string
  title: string
  /** HTML. */
  content: string
  /** The saved section it started from (so settings of its own are kept); null for a new one. */
  source: Record<string, unknown> | null
}

let keyCounter = 0
const nextKey = () => `section-${(keyCounter += 1)}`

/** A new, empty section. */
export const blankSection = (): SectionDraft => ({
  key: nextKey(),
  title: '',
  content: '',
  source: null,
})

/** The editor's working copy of the product's sections ([] when it has none). */
export function draftSections(
  product: Pick<ProductDetail, 'metafields'> | null | undefined,
): SectionDraft[] {
  return (parseApd(product)?.sections ?? []).map((section) => ({
    key: nextKey(),
    title: section.title,
    content: section.content,
    source: section.source,
  }))
}

/**
 * The metafield to send so the product's sections become `drafts` — or null when
 * nothing changed, or the product has no sections metafield to edit. Every other
 * setting saved in the metafield is kept as it was.
 */
export function buildSectionsMetafield(
  product: Pick<ProductDetail, 'metafields'>,
  drafts: SectionDraft[],
): ProductMetafieldInput | null {
  const apd = parseApd(product)
  if (!apd || apd.sections.length === 0) return null

  const unchanged =
    drafts.length === apd.sections.length &&
    drafts.every(
      (draft, index) =>
        draft.title.trim() === apd.sections[index].title &&
        draft.content === apd.sections[index].content,
    )
  if (unchanged) return null

  return {
    namespace: APD_NAMESPACE,
    key: APD_KEY,
    type: apd.type,
    value: JSON.stringify({
      ...apd.settings,
      sections: drafts.map((draft, index) => ({
        ...draft.source,
        title: draft.title.trim(),
        content: draft.content,
        position: index,
      })),
    }),
  }
}
