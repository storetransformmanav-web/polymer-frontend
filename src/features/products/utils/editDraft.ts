import {
  INVENTORY_POLICIES,
  PRODUCT_EDIT_STATUSES,
  WEIGHT_UNITS,
  type InventoryPolicy,
  type MediaType,
  type ProductDetail,
  type ProductImage,
  type ProductMediaInput,
  type ProductUpdateBody,
  type ProductVariant,
  type ProductVariantInput,
  type WeightUnit,
} from '../../../lib/api/endpoints.ts'
import { sameFile } from '../../../app/store/productPatch.ts'
import {
  APD_MAX_LENGTH,
  buildSectionsMetafield,
  draftSections,
  SECTION_TITLE_MAX,
  type SectionDraft,
} from './descriptionSections.ts'

/**
 * The edit form's working copy of a product, and the two pure steps around it:
 * `buildUpdateBody` turns the draft into the *smallest* possible update (the
 * API takes any subset of fields, and sending only what changed means an edit
 * never overwrites something a colleague changed in the meantime), and
 * `validateDraft` checks the draft against the API's limits before anything is sent.
 */

export interface VariantDraft {
  /** Stable React key. */
  key: string
  /** The CRM variant id. */
  id: string
  title: string
  price: string
  compareAtPrice: string
  sku: string
  barcode: string
  taxable: boolean
  inventoryPolicy: InventoryPolicy
  /** Track stock in Shopify. */
  tracked: boolean
  requiresShipping: boolean
  cost: string
  weight: string
  weightUnit: WeightUnit
  /** The product image (attachment id) to show for this variant; '' = leave as is. */
  imageId: string
  removed: boolean
}

/**
 * One of the product's existing images: its alt text and its place in the order
 * can be edited in the Media tab. Adding and removing files are separate,
 * immediate actions (`POST /media`, `DELETE /media/{id}`), not part of this draft.
 */
export interface ImageDraft {
  id: string
  url: string
  alt: string
}

/** A picture or video to attach by URL (the "Add media" form's rows). */
export interface NewMediaDraft {
  key: string
  url: string
  alt: string
  mediaType: MediaType
}

export interface ProductDraft {
  title: string
  descriptionHtml: string
  vendor: string
  productType: string
  status: string
  handle: string
  templateSuffix: string
  categoryGid: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  removedCollectionIds: string[]
  addedCollectionIds: string[]
  variants: VariantDraft[]
  /** Existing images in their current order (reordering changes this order). */
  images: ImageDraft[]
  /** The description sections (metafield apd), in order; [] when the product has none. */
  descriptionSections: SectionDraft[]
}

/** The limits the API enforces (from its schema). */
export const LIMITS = {
  title: 255,
  vendor: 255,
  productType: 255,
  handle: 255,
  templateSuffix: 100,
  categoryGid: 120,
  seoTitle: 70,
  seoDescription: 320,
  sku: 255,
  barcode: 255,
  mediaUrl: 2000,
  mediaAlt: 512,
  /** Media the API attaches in one call (`POST /media`). */
  newMedia: 20,
} as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let keyCounter = 0
/** A fresh key for a row that has no id yet. */
export const newKey = (prefix: string) => `${prefix}-${(keyCounter += 1)}`

const asInventoryPolicy = (value: string | null | undefined): InventoryPolicy =>
  INVENTORY_POLICIES.find((policy) => policy === value?.toUpperCase()) ?? 'DENY'

const asWeightUnit = (value: string | null | undefined): WeightUnit =>
  WEIGHT_UNITS.find((unit) => unit === value?.toUpperCase()) ?? 'GRAMS'

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value)

function variantLabel(variant: ProductVariant): string {
  return variant.title?.trim() || variant.display_name?.trim() || variant.sku || 'Variant'
}

/**
 * The product image a variant shows now: the one whose file is the variant's
 * `image_url` ('' when it has none of the product's images).
 */
export function variantImageId(variant: ProductVariant, images: ProductImage[]): string {
  const url = variant.image_url
  if (!url) return ''
  return images.find((image) => sameFile(image.url, url))?.id ?? ''
}

export function draftFromVariant(
  variant: ProductVariant,
  images: ProductImage[] = [],
): VariantDraft {
  return {
    key: variant.id,
    id: variant.id,
    title: variantLabel(variant),
    price: text(variant.price),
    compareAtPrice: text(variant.compare_at_price),
    sku: text(variant.sku),
    barcode: text(variant.barcode),
    taxable: variant.taxable ?? true,
    inventoryPolicy: asInventoryPolicy(variant.inventory_policy),
    tracked: Boolean(variant.inventory_management),
    requiresShipping: variant.requires_shipping ?? true,
    cost: text(variant.cost),
    weight: text(variant.weight),
    weightUnit: asWeightUnit(variant.weight_unit),
    imageId: variantImageId(variant, images),
    removed: false,
  }
}

export function blankMedia(): NewMediaDraft {
  return { key: newKey('new-media'), url: '', alt: '', mediaType: 'IMAGE' }
}

export function draftFromProduct(product: ProductDetail): ProductDraft {
  return {
    title: product.title,
    descriptionHtml: product.description_html ?? '',
    vendor: product.vendor ?? '',
    productType: product.product_type ?? '',
    status: (product.status ?? '').toUpperCase(),
    handle: product.handle,
    templateSuffix: product.template_suffix ?? '',
    categoryGid: '',
    tags: [...product.tags],
    seoTitle: product.seo?.title ?? '',
    seoDescription: product.seo?.description ?? '',
    removedCollectionIds: [],
    addedCollectionIds: [],
    variants: product.variants.map((variant) =>
      draftFromVariant(variant, product.images),
    ),
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt_text ?? '',
    })),
    descriptionSections: draftSections(product),
  }
}

// --- Numbers ---------------------------------------------------------------------

/** A non-negative decimal like "12", "12.5" or "0.075" (no signs, no exponents). */
const DECIMAL = /^\d+(\.\d+)?$/
const isDecimal = (value: string) => DECIMAL.test(value.trim())

/** Same number, ignoring formatting ("25.850" equals "25.85"). */
const sameNumber = (a: string, b: string) => {
  const x = a.trim()
  const y = b.trim()
  if (x === '' || y === '') return x === y
  return Number(x) === Number(y)
}

// --- Draft → update body -----------------------------------------------------------

/** The fields of an existing variant the user changed (or null if none). */
function variantChanges(
  original: ProductVariant,
  draft: VariantDraft,
  images: ProductImage[],
): ProductVariantInput | null {
  const base = draftFromVariant(original, images)
  const edit: ProductVariantInput = { id: draft.id ?? undefined }
  let changed = false
  const set = <K extends keyof ProductVariantInput>(
    key: K,
    value: ProductVariantInput[K],
  ) => {
    edit[key] = value
    changed = true
  }

  if (!sameNumber(draft.price, base.price)) set('price', draft.price.trim())
  if (!sameNumber(draft.compareAtPrice, base.compareAtPrice)) {
    set(
      'compare_at_price',
      draft.compareAtPrice.trim() === '' ? null : draft.compareAtPrice.trim(),
    )
  }
  if (!sameNumber(draft.cost, base.cost)) {
    set('cost', draft.cost.trim() === '' ? null : draft.cost.trim())
  }
  if (!sameNumber(draft.weight, base.weight)) {
    set('weight', draft.weight.trim() === '' ? null : draft.weight.trim())
  }
  if (draft.weightUnit !== base.weightUnit) set('weight_unit', draft.weightUnit)
  if (draft.sku.trim() !== base.sku) set('sku', draft.sku.trim())
  if (draft.barcode.trim() !== base.barcode) set('barcode', draft.barcode.trim())
  if (draft.taxable !== base.taxable) set('taxable', draft.taxable)
  if (draft.inventoryPolicy !== base.inventoryPolicy) {
    set('inventory_policy', draft.inventoryPolicy)
  }
  if (draft.tracked !== base.tracked) set('tracked', draft.tracked)
  if (draft.requiresShipping !== base.requiresShipping) {
    set('requires_shipping', draft.requiresShipping)
  }
  // Only a different picture is sent (the current one is preselected in the form).
  if (draft.imageId && draft.imageId !== base.imageId) {
    set('image_attachment_id', draft.imageId)
  }

  return changed ? edit : null
}

/**
 * The smallest update that turns `product` into `draft`. An empty object means
 * "nothing changed" — the form doesn't offer Save then.
 */
export function buildUpdateBody(
  product: ProductDetail,
  draft: ProductDraft,
): ProductUpdateBody {
  const body: ProductUpdateBody = {}

  if (draft.title.trim() !== product.title) body.title = draft.title.trim()
  if (draft.descriptionHtml !== (product.description_html ?? '')) {
    body.description_html = draft.descriptionHtml
  }
  if (draft.vendor.trim() !== (product.vendor ?? '')) body.vendor = draft.vendor.trim()
  if (draft.productType.trim() !== (product.product_type ?? '')) {
    body.product_type = draft.productType.trim()
  }
  if (draft.handle.trim() !== product.handle) body.handle = draft.handle.trim()
  if (draft.templateSuffix.trim() !== (product.template_suffix ?? '')) {
    body.template_suffix = draft.templateSuffix.trim()
  }
  // The current taxonomy id isn't known to the form, so only a typed one is sent.
  if (draft.categoryGid.trim()) body.category_gid = draft.categoryGid.trim()

  const status = draft.status.toUpperCase()
  if (
    status !== (product.status ?? '').toUpperCase() &&
    PRODUCT_EDIT_STATUSES.some((allowed) => allowed === status)
  ) {
    body.status = status as (typeof PRODUCT_EDIT_STATUSES)[number]
  }

  // Tags change as a diff, so a tag a colleague added meanwhile survives.
  const tagsAdd = draft.tags.filter((tag) => !product.tags.includes(tag))
  const tagsRemove = product.tags.filter((tag) => !draft.tags.includes(tag))
  if (tagsAdd.length) body.tags_add = tagsAdd
  if (tagsRemove.length) body.tags_remove = tagsRemove

  if (
    draft.seoTitle.trim() !== (product.seo?.title ?? '') ||
    draft.seoDescription.trim() !== (product.seo?.description ?? '')
  ) {
    body.seo = { title: draft.seoTitle.trim(), description: draft.seoDescription.trim() }
  }

  const known = new Set(product.collections.map((collection) => collection.id))
  const collectionsAdd = [...new Set(draft.addedCollectionIds)].filter(
    (id) => !known.has(id),
  )
  if (collectionsAdd.length) body.collections_add = collectionsAdd
  if (draft.removedCollectionIds.length)
    body.collections_remove = draft.removedCollectionIds

  const variantEdits: ProductVariantInput[] = []
  const variantsRemove: string[] = []
  for (const variant of draft.variants) {
    if (variant.removed) {
      variantsRemove.push(variant.id)
      continue
    }
    const original = product.variants.find((candidate) => candidate.id === variant.id)
    const edit = original ? variantChanges(original, variant, product.images) : null
    if (edit) variantEdits.push(edit)
  }
  if (variantEdits.length) body.variants = variantEdits
  if (variantsRemove.length) body.variants_remove = variantsRemove

  const mediaUpdate = draft.images.flatMap((image) => {
    const original = product.images.find((candidate) => candidate.id === image.id)
    return original && image.alt.trim() !== (original.alt_text ?? '')
      ? [{ attachment_id: image.id, alt: image.alt.trim() }]
      : []
  })
  if (mediaUpdate.length) body.media_update = mediaUpdate

  const order = draft.images.map((image) => image.id)
  const originalOrder = product.images
    .map((image) => image.id)
    .filter((id) => order.includes(id))
  if (order.some((id, index) => id !== originalOrder[index])) body.media_order = order

  // The description sections are one metafield (a JSON string): sent whole, only if changed.
  const sections = buildSectionsMetafield(product, draft.descriptionSections)
  if (sections) body.metafields = [sections]

  return body
}

export const hasChanges = (body: ProductUpdateBody) => Object.keys(body).length > 0

// --- Validation --------------------------------------------------------------------

/** Messages keyed by field path, e.g. `title`, `variants.2.price`, `newMedia.0.url`. */
export type DraftErrors = Record<string, string>

const tooLong = (label: string, value: string, max: number) =>
  value.trim().length > max ? `${label} can be at most ${max} characters` : null

/** The rows of the "Add media" form → the items `POST /media` expects (blank rows are skipped). */
export function buildMediaItems(rows: NewMediaDraft[]): ProductMediaInput[] {
  const seen = new Set<string>()
  return (
    rows
      .filter((row) => row.url.trim() !== '')
      // The same address twice would add the same picture twice.
      .filter((row) => {
        const key = row.url.trim().toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((row) => ({
        url: row.url.trim(),
        media_type: row.mediaType,
        ...(row.alt.trim() ? { alt: row.alt.trim() } : {}),
      }))
  )
}

/**
 * Checks the "Add media" rows against the API's limits. Keys are `<row>.url`,
 * `<row>.alt` and `rows` (for the list as a whole). Fully blank rows are ignored,
 * but at least one file is needed.
 */
export function validateNewMedia(rows: NewMediaDraft[]): DraftErrors {
  const errors: DraftErrors = {}
  const used = rows.filter((row) => row.url.trim() !== '' || row.alt.trim() !== '')
  if (rows.every((row) => row.url.trim() === '')) {
    errors.rows = 'Enter the web address of at least one file'
  }
  if (used.length > LIMITS.newMedia) {
    errors.rows = `You can add at most ${LIMITS.newMedia} files at a time`
  }
  const firstSeen = new Map<string, number>()
  rows.forEach((row, index) => {
    const url = row.url.trim()
    if (url === '' && row.alt.trim() === '') return
    const key = url.toLowerCase()
    const duplicate = url !== '' && firstSeen.has(key)
    if (url !== '' && !duplicate) firstSeen.set(key, index)
    const urlProblem =
      url === ''
        ? 'Enter the file’s web address'
        : duplicate
          ? 'This address is already in the list above'
          : url.length > LIMITS.mediaUrl
            ? `The address can be at most ${LIMITS.mediaUrl} characters`
            : /^https:\/\//i.test(url)
              ? null
              : 'Use a public https:// address'
    if (urlProblem) errors[`${index}.url`] = urlProblem
    const altProblem = tooLong('The alt text', row.alt, LIMITS.mediaAlt)
    if (altProblem) errors[`${index}.alt`] = altProblem
  })
  return errors
}

/** Checks a draft against the API's limits. An empty result means it can be sent. */
export function validateDraft(product: ProductDetail, draft: ProductDraft): DraftErrors {
  const errors: DraftErrors = {}
  const put = (key: string, message: string | null) => {
    if (message) errors[key] = message
  }

  put('title', draft.title.trim() ? null : 'Enter a title')
  put('title', errors.title ?? tooLong('The title', draft.title, LIMITS.title))
  put('vendor', tooLong('The vendor', draft.vendor, LIMITS.vendor))
  put('productType', tooLong('The product type', draft.productType, LIMITS.productType))
  put('handle', tooLong('The handle', draft.handle, LIMITS.handle))
  put(
    'templateSuffix',
    tooLong('The template suffix', draft.templateSuffix, LIMITS.templateSuffix),
  )
  put('categoryGid', tooLong('The category ID', draft.categoryGid, LIMITS.categoryGid))
  put('seoTitle', tooLong('The SEO title', draft.seoTitle, LIMITS.seoTitle))
  put(
    'seoDescription',
    tooLong('The SEO description', draft.seoDescription, LIMITS.seoDescription),
  )

  draft.addedCollectionIds.forEach((id, index) => {
    put(`addedCollections.${index}`, UUID.test(id) ? null : 'Not a valid collection ID')
  })

  // The store needs at least one variant: removing them all would leave an unsellable product.
  if (product.variants.length > 0 && draft.variants.every((variant) => variant.removed)) {
    errors.variants = 'A product needs at least one variant'
  }

  draft.variants.forEach((variant, index) => {
    if (variant.removed) return
    const at = (field: string) => `variants.${index}.${field}`

    if (variant.price.trim() !== '') {
      put(
        at('price'),
        variant.price.trim() === ''
          ? 'Enter a price'
          : isDecimal(variant.price)
            ? null
            : 'Enter a number, 0 or more',
      )
    }
    for (const [field, label, value] of [
      ['compareAtPrice', 'Compare-at price', variant.compareAtPrice],
      ['cost', 'Cost', variant.cost],
      ['weight', 'Weight', variant.weight],
    ] as const) {
      if (value.trim() !== '' && !isDecimal(value))
        put(at(field), `${label}: enter a number, 0 or more`)
    }
    put(at('sku'), tooLong('The SKU', variant.sku, LIMITS.sku))
    put(at('barcode'), tooLong('The barcode', variant.barcode, LIMITS.barcode))
  })

  draft.images.forEach((image, index) => {
    put(`images.${index}.alt`, tooLong('The alt text', image.alt, LIMITS.mediaAlt))
  })

  draft.descriptionSections.forEach((section, index) => {
    put(
      `descriptionSections.${index}.title`,
      section.title.trim()
        ? tooLong('The title', section.title, SECTION_TITLE_MAX)
        : 'Enter a title',
    )
  })
  const sectionsValue = buildSectionsMetafield(product, draft.descriptionSections)?.value
  if (sectionsValue && sectionsValue.length > APD_MAX_LENGTH) {
    errors.descriptionSections = 'There is too much text in the sections to save'
  }

  return errors
}
