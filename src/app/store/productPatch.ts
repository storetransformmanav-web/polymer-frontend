import type {
  ProductDetail,
  ProductImage,
  ProductListItem,
  ProductUpdateBody,
  ProductVariant,
} from '../../lib/api/endpoints.ts'

/**
 * Applies a saved edit (the body that was sent to `PUT /products/{id}`) to the
 * product data already in the cache. Called the moment the server confirms the
 * save, so the list and the details show the new values at once — no loader —
 * while a background refetch fetches the authoritative copy. Only what can be
 * worked out from the edit itself is patched; things the server decides (ids of
 * new variants and images, a recomputed price range) arrive with that refetch.
 */

/** The tag list after `tags` (replace) / `tags_add` / `tags_remove`. */
export function patchTags(tags: string[], body: ProductUpdateBody): string[] {
  let next = body.tags ? [...body.tags] : [...tags]
  for (const tag of body.tags_add ?? []) if (!next.includes(tag)) next.push(tag)
  if (body.tags_remove?.length) {
    const removed = new Set(body.tags_remove)
    next = next.filter((tag) => !removed.has(tag))
  }
  return next
}

/** The same file, ignoring a CDN's cache-busting query string (`?v=123`). */
export const sameFile = (a: string, b: string) => a.split('?')[0] === b.split('?')[0]

/** The picture a just-created product was given, shown until the store's own copy exists. */
export interface PreviewImage {
  url: string
  /** When the product was created (ms). */
  at: number
}

/** After this long a preview that was never replaced is dropped. */
export const PREVIEW_IMAGE_TTL_MS = 10 * 60_000

/**
 * A just-created product's image is downloaded by the store afterwards, so a list
 * read in the meantime returns its row with no image — which would wipe the
 * picture that was on screen. This puts the preview back on such a row, and
 * forgets a preview once the row has an image of its own (a different address),
 * or it is too old. `items` is returned as is when nothing changed.
 */
export function keepPreviewImages(
  items: ProductListItem[],
  previews: Record<string, PreviewImage>,
  now: number,
): { items: ProductListItem[]; previews: Record<string, PreviewImage> } {
  const remaining = { ...previews }
  let changed = false
  const next = items.map((item) => {
    const preview = remaining[item.id]
    if (!preview) return item
    if (now - preview.at >= PREVIEW_IMAGE_TTL_MS) {
      delete remaining[item.id]
      return item
    }
    if (!item.image_url) {
      changed = true
      return { ...item, image_url: preview.url }
    }
    if (item.image_url !== preview.url) delete remaining[item.id]
    return item
  })
  return { items: changed ? next : items, previews: remaining }
}

/** An image that was deleted, but that the backend may still list for a while. */
export interface RemovedImage {
  id: string
  url: string
  /** When it was deleted (ms). */
  at: number
}

/** After this long a deleted image that is still listed is shown again (something went wrong). */
export const REMOVED_IMAGE_TTL_MS = 10 * 60_000

/**
 * The delete is only *queued* in the store ("Media removal queued"), so the
 * product the backend returns a moment later still lists the image. This keeps a
 * deleted image off the page until the backend stops listing it: it returns the
 * images without those still-listed deleted ones, and the deleted images the
 * backend has now dropped (or that are older than the limit) to forget.
 */
export function hideRemovedImages(
  images: ProductImage[],
  removed: RemovedImage[],
  now: number,
): { images: ProductImage[]; stillListed: RemovedImage[] } {
  const stillListed = removed.filter(
    (gone) =>
      now - gone.at < REMOVED_IMAGE_TTL_MS &&
      images.some((image) => image.id === gone.id || sameFile(image.url, gone.url)),
  )
  if (stillListed.length === 0) return { images, stillListed }
  return {
    images: images.filter(
      (image) =>
        !stillListed.some(
          (gone) => image.id === gone.id || sameFile(image.url, gone.url),
        ),
    ),
    stillListed,
  }
}

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : String(value)

export function patchListItem(
  item: ProductListItem,
  body: ProductUpdateBody,
): ProductListItem {
  return {
    ...item,
    title: body.title ?? item.title,
    handle: body.handle ?? item.handle,
    vendor: body.vendor ?? item.vendor,
    product_type: body.product_type ?? item.product_type,
    status: body.status ?? item.status,
    tags: patchTags(item.tags, body),
  }
}

function patchVariant(
  variant: ProductVariant,
  body: ProductUpdateBody,
): ProductVariant | null {
  if (body.variants_remove?.includes(variant.id)) return null
  const edit = body.variants?.find((candidate) => candidate.id === variant.id)
  if (!edit) return variant

  return {
    ...variant,
    price: edit.price !== undefined ? (text(edit.price) ?? variant.price) : variant.price,
    compare_at_price:
      edit.compare_at_price !== undefined
        ? text(edit.compare_at_price)
        : variant.compare_at_price,
    cost: edit.cost !== undefined ? text(edit.cost) : variant.cost,
    weight: edit.weight !== undefined ? text(edit.weight) : variant.weight,
    weight_unit: edit.weight_unit ?? variant.weight_unit,
    sku: edit.sku ?? variant.sku,
    barcode: edit.barcode ?? variant.barcode,
    taxable: edit.taxable ?? variant.taxable,
    requires_shipping: edit.requires_shipping ?? variant.requires_shipping,
    inventory_policy: edit.inventory_policy ?? variant.inventory_policy,
  }
}

export function patchDetail(
  product: ProductDetail,
  body: ProductUpdateBody,
): ProductDetail {
  let images = product.images
  if (body.media_remove?.length) {
    const removed = new Set(body.media_remove)
    images = images.filter((image) => !removed.has(image.id))
  }
  if (body.media_update?.length) {
    images = images.map((image) => {
      const edit = body.media_update?.find(
        (candidate) => candidate.attachment_id === image.id,
      )
      return edit ? { ...image, alt_text: edit.alt } : image
    })
  }
  if (body.media_order?.length) {
    const rank = new Map(body.media_order.map((id, index) => [id, index]))
    images = [...images].sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  }

  const collectionsRemoved = new Set(body.collections_remove ?? [])

  return {
    ...product,
    title: body.title ?? product.title,
    description_html: body.description_html ?? product.description_html,
    vendor: body.vendor ?? product.vendor,
    product_type: body.product_type ?? product.product_type,
    status: body.status ?? product.status,
    handle: body.handle ?? product.handle,
    template_suffix: body.template_suffix ?? product.template_suffix,
    tags: patchTags(product.tags, body),
    seo: body.seo ? { ...product.seo, ...body.seo } : product.seo,
    collections: product.collections.filter(
      (collection) => !collectionsRemoved.has(collection.id),
    ),
    variants: product.variants
      .map((variant) => patchVariant(variant, body))
      .filter((variant): variant is ProductVariant => variant !== null),
    images,
  }
}
