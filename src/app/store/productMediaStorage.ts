import { z } from 'zod'

/**
 * What the products slice remembers about images the store is still working on —
 * files just added (`pendingMedia`), images just deleted (`removedMedia`) and the
 * picture a just-created product was given (`previewImages`) — kept in this tab's
 * sessionStorage so a page refresh doesn't lose it. Without it, a refresh in the
 * minutes while the store is still downloading would show "No images" (the CRM
 * only has an image once the store has finished), even though the files are on
 * their way. Only web addresses and ids are stored (nothing secret); the data is
 * validated when read, entries older than a day are dropped, and it is cleared
 * when the session ends.
 */

export const PRODUCT_MEDIA_STORAGE_KEY = 'polymer-crm:product-media'

/** Nothing older than this is restored (the store has long finished, or never will). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

const httpsUrl = z.string().max(2000).startsWith('https://')

const mediaInputSchema = z.object({
  url: httpsUrl,
  alt: z.string().max(512).optional(),
  media_type: z.enum(['IMAGE', 'VIDEO', 'EXTERNAL_VIDEO', 'MODEL_3D']).optional(),
})

const storedSchema = z.object({
  pendingMedia: z
    .record(
      z.string(),
      z.object({
        items: z.array(mediaInputSchema).max(100),
        baseline: z.number().int().min(0),
        startedAt: z.number(),
        leading: z.boolean().optional(),
        placed: z.number().int().min(0).optional(),
        variantLinks: z
          .array(z.object({ variantId: z.string(), url: z.string() }))
          .max(100)
          .optional(),
      }),
    )
    .default({}),
  removedMedia: z
    .record(
      z.string(),
      z.array(z.object({ id: z.string(), url: z.string().max(2000), at: z.number() })),
    )
    .default({}),
  previewImages: z
    .record(z.string(), z.object({ url: httpsUrl, at: z.number() }))
    .default({}),
})

export type StoredProductMedia = z.infer<typeof storedSchema>

const isEmpty = (data: StoredProductMedia) =>
  Object.keys(data.pendingMedia).length === 0 &&
  Object.keys(data.removedMedia).length === 0 &&
  Object.keys(data.previewImages).length === 0

/** The saved data, checked and without anything too old — or null when there is none. */
export function loadProductMedia(now = Date.now()): StoredProductMedia | null {
  try {
    const raw = window.sessionStorage.getItem(PRODUCT_MEDIA_STORAGE_KEY)
    if (!raw) return null
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const fresh = (at: number) => now - at < MAX_AGE_MS
    const data = parsed.data

    const result: StoredProductMedia = {
      pendingMedia: Object.fromEntries(
        Object.entries(data.pendingMedia).filter(([, entry]) => fresh(entry.startedAt)),
      ),
      removedMedia: Object.fromEntries(
        Object.entries(data.removedMedia)
          .map(([id, list]) => [id, list.filter((item) => fresh(item.at))] as const)
          .filter(([, list]) => list.length > 0),
      ),
      previewImages: Object.fromEntries(
        Object.entries(data.previewImages).filter(([, entry]) => fresh(entry.at)),
      ),
    }
    return isEmpty(result) ? null : result
  } catch {
    return null
  }
}

/** Saves the data (or removes it when there is nothing left to remember). */
export function saveProductMedia(data: StoredProductMedia): void {
  try {
    if (isEmpty(data)) window.sessionStorage.removeItem(PRODUCT_MEDIA_STORAGE_KEY)
    else window.sessionStorage.setItem(PRODUCT_MEDIA_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // sessionStorage unavailable — a refresh just starts from what the backend has.
  }
}
