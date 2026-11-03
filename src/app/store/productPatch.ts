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

/** The metafields after `metafields` (set: replaces the value or adds it) / `metafields_remove`. */
export function patchMetafields(
  metafields: ProductDetail['metafields'],
  body: ProductUpdateBody,
): ProductDetail['metafields'] {
  if (!body.metafields?.length && !body.metafields_remove?.length) return metafields
  const same = (
    a: { namespace: string; key: string },
    b: { namespace: string; key: string },
  ) => a.namespace === b.namespace && a.key === b.key
  const removed = body.metafields_remove ?? []
  let next = metafields.filter((field) => !removed.some((gone) => same(field, gone)))
  for (const set of body.metafields ?? []) {
    const exists = next.some((field) => same(field, set))
    next = exists
      ? next.map((field) =>
          same(field, set) ? { ...field, type: set.type, value: set.value } : field,
        )
      : [
          ...next,
          { namespace: set.namespace, key: set.key, type: set.type, value: set.value },
        ]
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

/** The option names and values of a variant after `options_update` renamed some of them. */
function patchSelectedOptions(
  selected: ProductVariant['selected_options'],
  body: ProductUpdateBody,
): ProductVariant['selected_options'] {
  if (!selected || !body.options_update?.length) return selected
  return selected.map((chosen) => {
    const update = body.options_update?.find(
      (candidate) => candidate.name === chosen.name,
    )
    if (!update) return chosen
    const renamed = update.values_rename?.find((pair) => pair.from === chosen.value)
    return { name: update.new_name ?? chosen.name, value: renamed?.to ?? chosen.value }
  })
}

/** A stock edit: the level at each location is set, and one is added where there was none. */
function patchLevels(
  levels: ProductVariant['inventory_levels'],
  stock: NonNullable<ProductUpdateBody['variants']>[number]['stock'],
): ProductVariant['inventory_levels'] {
  const rows = stock ?? []
  const known = new Set(levels.map((level) => level.location_shopify_id))
  return [
    ...levels.map((level) => {
      const set = rows.find((row) => row.location_id === level.location_shopify_id)
      return set ? { ...level, available: set.available } : level
    }),
    ...rows
      .filter((row) => !known.has(row.location_id))
      .map((row) => ({
        location_shopify_id: row.location_id,
        location_name: null,
        available: row.available,
      })),
  ]
}

/** The stock across the locations that give a figure; `fallback` when none does. */
function sumAvailable(
  levels: ProductVariant['inventory_levels'],
  fallback: number | null | undefined,
): number | null | undefined {
  const counted = levels
    .map((level) => level.available)
    .filter((available): available is number => typeof available === 'number')
  return counted.length > 0
    ? counted.reduce((sum, available) => sum + available, 0)
    : fallback
}

function patchVariant(
  variant: ProductVariant,
  body: ProductUpdateBody,
  images: ProductDetail['images'],
): ProductVariant | null {
  if (body.variants_remove?.includes(variant.id)) return null
  const edit = body.variants?.find((candidate) => candidate.id === variant.id)
  const selected_options = patchSelectedOptions(variant.selected_options, body)
  if (!edit)
    return selected_options === variant.selected_options
      ? variant
      : { ...variant, selected_options }

  // A picked picture is one of the product's images; "no image" takes it off.
  const picked = edit.image_attachment_id
    ? images.find((image) => image.id === edit.image_attachment_id)
    : undefined
  const image_url = edit.remove_image ? null : (picked?.url ?? variant.image_url)

  // Only a stock edit touches the levels — and the variant's own total follows them, so the
  // Variants tab agrees with the Inventory tab at once.
  const inventory_levels = edit.stock
    ? patchLevels(variant.inventory_levels, edit.stock)
    : variant.inventory_levels
  const inventory_quantity = edit.stock
    ? sumAvailable(inventory_levels, variant.inventory_quantity)
    : variant.inventory_quantity

  return {
    ...variant,
    selected_options,
    image_url,
    inventory_levels,
    inventory_quantity,
    price: edit.price !== undefined ? (text(edit.price) ?? variant.price) : variant.price,
    compare_at_price:
      edit.compare_at_price !== undefined
        ? text(edit.compare_at_price)
        : variant.compare_at_price,
    cost: edit.cost !== undefined ? text(edit.cost) : variant.cost,
    weight: edit.weight !== undefined ? text(edit.weight) : variant.weight,
    weight_unit: edit.weight_unit ?? variant.weight_unit,
    // A packed size of 0 × 0 × 0 is how the API clears it.
    packed_dimensions: edit.packed_dimensions
      ? edit.packed_dimensions.length > 0
        ? { ...edit.packed_dimensions }
        : null
      : variant.packed_dimensions,
    country_code_of_origin:
      edit.country_code_of_origin !== undefined
        ? edit.country_code_of_origin
        : variant.country_code_of_origin,
    harmonized_system_code:
      edit.harmonized_system_code !== undefined
        ? edit.harmonized_system_code
        : variant.harmonized_system_code,
    sku: edit.sku ?? variant.sku,
    barcode: edit.barcode ?? variant.barcode,
    taxable: edit.taxable ?? variant.taxable,
    requires_shipping: edit.requires_shipping ?? variant.requires_shipping,
    inventory_policy: edit.inventory_policy ?? variant.inventory_policy,
    // The variant's own metafields: set (value replaced or added) and removed.
    metafields: patchMetafields(variant.metafields, edit),
  }
}

/** The lowest and highest figure the variants give, written as the variants wrote them. */
function rangeOf(
  variants: ProductVariant[],
  read: (variant: ProductVariant) => string | null | undefined,
): { min: string; max: string } | null {
  let min: string | null = null
  let max: string | null = null
  for (const variant of variants) {
    const value = read(variant)
    if (value === null || value === undefined || value.trim() === '') continue
    if (!Number.isFinite(Number(value))) continue
    if (min === null || Number(value) < Number(min)) min = value
    if (max === null || Number(value) > Number(max)) max = value
  }
  return min === null || max === null ? null : { min, max }
}

/**
 * The figures of a list row that follow a stock or price edit — its stock total and its price range
 * — taken from the product's own patched copy, so the list agrees with the details page at once.
 */
export function patchListFigures(
  item: ProductListItem,
  detail: ProductDetail,
  body: ProductUpdateBody,
): ProductListItem {
  let next = item
  if (body.variants?.some((edit) => edit.stock)) {
    next = { ...next, total_inventory: detail.total_inventory ?? next.total_inventory }
  }
  if (body.variants?.some((edit) => edit.price !== undefined)) {
    const range = detail.price_range
    if (range?.min && range?.max) {
      next = { ...next, price_min: range.min, price_max: range.max }
    }
  }
  return next
}

export function patchDetail(
  product: ProductDetail,
  body: ProductUpdateBody,
): ProductDetail {
  let images = product.images
  let featured = product.featured_image_url
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
    // The first image is the main one, so the featured image follows the new order.
    featured = images[0]?.url ?? featured
  }

  // `collections_remove` carries collection names, like `collections_add`.
  const collectionsRemoved = new Set(
    (body.collections_remove ?? []).map((name) => name.trim().toLowerCase()),
  )
  const metafields = patchMetafields(product.metafields, body)
  const variants = product.variants
    .map((variant) => patchVariant(variant, body, images))
    .filter((variant): variant is ProductVariant => variant !== null)
  // A stock edit changes the product's total too (the header and the Variants footer read it).
  const stockEdited = body.variants?.some((edit) => edit.stock)
  const total_inventory = stockEdited
    ? variants.reduce((sum, variant) => sum + (variant.inventory_quantity ?? 0), 0)
    : product.total_inventory

  // A price edit moves the header's range (and the compare-at range) at once.
  const priceRange = body.variants?.some((edit) => edit.price !== undefined)
    ? rangeOf(variants, (variant) => variant.price)
    : null
  const compareEdited = body.variants?.some((edit) => edit.compare_at_price !== undefined)
  const compareRange = compareEdited
    ? rangeOf(variants, (variant) => variant.compare_at_price)
    : null

  return {
    ...product,
    total_inventory,
    price_range: priceRange
      ? { ...product.price_range, ...priceRange }
      : product.price_range,
    compare_at_price_range: compareEdited
      ? compareRange
        ? { ...product.compare_at_price_range, ...compareRange }
        : null
      : product.compare_at_price_range,
    title: body.title ?? product.title,
    description_html: body.description_html ?? product.description_html,
    vendor: body.vendor ?? product.vendor,
    product_type: body.product_type ?? product.product_type,
    status: body.status ?? product.status,
    handle: body.handle ?? product.handle,
    template_suffix: body.template_suffix ?? product.template_suffix,
    tags: patchTags(product.tags, body),
    metafields,
    featured_image_url: featured,
    seo: body.seo ? { ...product.seo, ...body.seo } : product.seo,
    collections: product.collections.filter(
      (collection) => !collectionsRemoved.has(collection.title.trim().toLowerCase()),
    ),
    options: patchOptions(product.options, body),
    variants,
    images,
  }
}

/** The product's options after renames and additions (the new ones go last). */
function patchOptions(
  options: ProductDetail['options'],
  body: ProductUpdateBody,
): ProductDetail['options'] {
  if (!body.options_update?.length && !body.options_add?.length) return options
  const renamed = options.map((option) => {
    const update = body.options_update?.find(
      (candidate) => candidate.name === option.name,
    )
    if (!update) return option
    return {
      ...option,
      name: update.new_name ?? option.name,
      values: option.values.map(
        (value) => update.values_rename?.find((pair) => pair.from === value)?.to ?? value,
      ),
    }
  })
  const added = (body.options_add ?? []).map((option, index) => ({
    name: option.name,
    position: renamed.length + index + 1,
    values: option.values,
  }))
  return [...renamed, ...added]
}
