import { sanitizeHtml } from '../../../lib/sanitizeHtml.ts'
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

/**
 * Every setting of the `apd` metafield the description app saves, as it saves it (everything in
 * the JSON but `sections`). A new metafield is written with all of them, so it has the same
 * format the app itself produces; an existing one keeps its own.
 */
export const DEFAULT_APD_SETTINGS = {
  saved: true,
  kind: 1,
  overwrite_styles: false,
  inherit_fonts: true,
  rounded_corners: true,
  disable: false,
  font_size: 1,
  spacing: 1,
  bold_section_titles: true,
  border_color: '#e2e2e2',
  text_color: '#5e5e5e',
  heading_color: '#121212',
  accent_color: '#557b97',
  accordian_open: 2,
  accordian_heading_color: '#121212',
  accordian_icon_color: '#5e5e5e',
  accordian_side_borders: false,
  accordian_multi: false,
  accordian_border_color: '#e2e2e2',
  accordian_bg_color: 'rgba(255,255,255,0)',
  accordian_icon: 1,
  switcher_style: 2,
  tabs_bordered: false,
  switcher_swipe: false,
  bottom_line_text_color: '#121212',
  bottom_line_color: '#e2e2e2',
  bottom_line_active_color: '#557b97',
  bottom_line_inactive_text_color: '#848484',
  tabs_border_color: '#e2e2e2',
  tabs_color: '#121212',
  tabs_bg_color: 'rgba(255,255,255,0)',
  tabs_inactive_color: '#848484',
  tabs_hover_bg_color: '#f5f5f5',
  ios_active_bg_color: '#557b97',
  ios_bg_color: 'rgba(255,255,255,0)',
  ios_active_color: '#fff',
  ios_color: '#557b97',
  buttons_active_bg_color: '#557b97',
  buttons_bg_color: '#f1f1f1',
  buttons_active_color: '#fff',
  buttons_color: '#5e5e5e',
}

/** A section as the app saves a new one: title, HTML, position, and the two flags it keeps. */
const newSection = (draft: SectionDraft, index: number) => ({
  title: draft.title.trim(),
  // Cleaned before it leaves (lib/sanitizeHtml.ts).
  content: sanitizeHtml(draft.content),
  position: index,
  chosen: false,
  selected: false,
})

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

  // The checked copy puts the keys it knows first; what is written back is the saved text's own
  // object, so every key stays where it was.
  const saved = json as { sections: Record<string, unknown>[] } & Record<string, unknown>
  return {
    type: field.type || 'json_string',
    settings: saved,
    sections: parsed.data.sections
      .map((section, index) => ({
        source: saved.sections[index] ?? section,
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

/** True when formatted text has nothing a customer would see (no words, picture, table or video). */
export function isBlankHtml(html: string): boolean {
  if (/<(img|table|iframe|video|oembed)/i.test(html)) return false
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .trim() === ''
  )
}

/** A section that was never saved and still has no text: it is left out when saving. */
const worthSaving = (draft: SectionDraft) =>
  draft.source !== null || !isBlankHtml(draft.content)

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

/** The product has an `apd` metafield at all (readable or not). */
function hasApdField(
  product: Pick<ProductDetail, 'metafields'> | null | undefined,
): boolean {
  return Boolean(
    product?.metafields.some(
      (item) => item.namespace === APD_NAMESPACE && item.key === APD_KEY && item.value,
    ),
  )
}

/**
 * Sections can be added to a product that has none: it has no `apd` metafield yet, or one that
 * is readable but holds no section. Not when the metafield is there but can't be read — saving
 * would write over whatever the description app keeps in it.
 */
export function canAddDescriptionSections(
  product: Pick<ProductDetail, 'metafields'> | null | undefined,
): boolean {
  return parseApd(product) !== null || !hasApdField(product)
}

/**
 * The metafield to send so the product's sections become `drafts` — or null when nothing
 * changed. Every other setting saved in the metafield is kept as it was. A product with no
 * sections yet gets them too: a readable metafield with none keeps its own settings and type;
 * a product with no metafield at all gets a new one, as Add product sends it
 * (`buildNewSectionsMetafield`). A metafield that can't be read is never written over.
 */
export function buildSectionsMetafield(
  product: Pick<ProductDetail, 'metafields'>,
  allDrafts: SectionDraft[],
): ProductMetafieldInput | null {
  const drafts = allDrafts.filter(worthSaving)
  // Every section deleted: the metafield is removed instead (see `buildSectionsRemoval`).
  if (drafts.length === 0) return null
  const apd = parseApd(product)
  if (!apd) return hasApdField(product) ? null : buildNewSectionsMetafield(drafts)
  if (apd.sections.length === 0) {
    return {
      namespace: APD_NAMESPACE,
      key: APD_KEY,
      type: apd.type,
      value: JSON.stringify({
        ...apd.settings,
        sections: drafts.map(newSection),
      }),
    }
  }

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
        // A section that was there keeps everything of its own; a new one gets the app's flags.
        ...(draft.source ?? { chosen: false, selected: false }),
        title: draft.title.trim(),
        // Cleaned before it leaves (lib/sanitizeHtml.ts).
        content: sanitizeHtml(draft.content),
        position: index,
      })),
    }),
  }
}

/**
 * The `apd` metafield for a product that is being **created** with sections — null when there are
 * none. Same JSON the description app saves: `{ ...settings, sections: [{ title, content,
 * position, chosen, selected }] }` with all of the app's settings (`DEFAULT_APD_SETTINGS`), one
 * section open at a time.
 */
export function buildNewSectionsMetafield(
  allDrafts: SectionDraft[],
): { namespace: string; key: string; type: string; value: string } | null {
  const drafts = allDrafts.filter(worthSaving)
  if (drafts.length === 0) return null
  return {
    namespace: APD_NAMESPACE,
    key: APD_KEY,
    type: 'json_string',
    value: JSON.stringify({
      ...DEFAULT_APD_SETTINGS,
      sections: drafts.map(newSection),
    }),
  }
}

/**
 * The metafield to remove when **every** section was deleted from a product that has sections:
 * its `apd` metafield. Null when sections remain, or the product has none to delete.
 */
export function buildSectionsRemoval(
  product: Pick<ProductDetail, 'metafields'>,
  drafts: SectionDraft[],
): { namespace: string; key: string } | null {
  if (drafts.length > 0) return null
  const apd = parseApd(product)
  if (!apd || apd.sections.length === 0) return null
  return { namespace: APD_NAMESPACE, key: APD_KEY }
}
