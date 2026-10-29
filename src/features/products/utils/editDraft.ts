import {
  INVENTORY_POLICIES,
  PRODUCT_EDIT_STATUSES,
  WEIGHT_UNITS,
  type InventoryPolicy,
  type MediaType,
  type ProductDetail,
  type ProductImage,
  type ProductMediaInput,
  type ProductMetafieldInput,
  type ProductMetafieldRemoval,
  type ProductOptionUpdate,
  type ProductUpdateBody,
  type ProductVariant,
  type ProductVariantInput,
  type WeightUnit,
} from '../../../lib/api/endpoints.ts'
import { sameFile } from '../../../app/store/productPatch.ts'
import { collectionKey } from './collectionSuggestions.ts'
import {
  APD_KEY,
  APD_MAX_LENGTH,
  APD_NAMESPACE,
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
  /**
   * The tax code to set (e.g. a Shopify Tax product code). The details answer does not say the
   * variant's current one, so this starts empty and a typed value is the only thing sent.
   */
  taxCode: string
  inventoryPolicy: InventoryPolicy
  /** Track stock in Shopify. */
  tracked: boolean
  requiresShipping: boolean
  cost: string
  weight: string
  weightUnit: WeightUnit
  /** The product image (attachment id) to show for this variant; '' = leave as is. */
  imageId: string
  /** The variant shows a picture now (so "No image" is a change worth offering). */
  hasImage: boolean
  /** Take the picture off this variant (the product keeps it). */
  removeImage: boolean
  /** Its stock at each location the store has recorded for it. */
  stock: StockRowDraft[]
  removed: boolean
}

/**
 * One row of a variant's stock table: a location (chosen from a dropdown) and a quantity. A row
 * is sent only when its location or its quantity differs from what the form opened with.
 */
export interface StockRowDraft {
  key: string
  /** The Shopify location number being chosen ('' = none yet). */
  locationId: string
  /** The quantity being typed. */
  available: string
  /** The location this row had when the form opened ('' for a row added here). */
  originalLocationId: string
  /** The quantity it had then ('' for a row added here). */
  original: string
}

/** An option of the product (Size…): rename it, or any of its values. */
export interface OptionDraft {
  key: string
  /** The current name (what the API is told to look for). */
  name: string
  /** The name being typed. */
  newName: string
  values: { from: string; to: string }[]
}

/** A new option (Colour → Clear, Black) to add to the product. */
export interface AddedOptionDraft {
  key: string
  name: string
  values: string[]
}

/** A variant to add: no id yet, one value per option, in option order. */
export interface NewVariantDraft {
  key: string
  /** One value per option — the product's options, then the ones added in this edit. */
  optionValues: string[]
  price: string
  compareAtPrice: string
  sku: string
  barcode: string
  cost: string
  weight: string
  weightUnit: WeightUnit
  /** Opening stock, a quantity per location. */
  stock: StockRowDraft[]
  /** A public https address of a picture for it ('' = none). */
  imageUrl: string
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

/**
 * One metafield (an extra custom detail) of the product or of one of its variants, as edited
 * in the Metafields tab. An existing one can have its value changed or be removed; a new one
 * needs a namespace, a key, a type and a value.
 */
export interface MetafieldEditDraft {
  /** Stable React key. */
  key: string
  /** The CRM variant id it belongs to; null = the whole product. */
  variantId: string | null
  namespace: string
  metaKey: string
  type: string
  value: string
  /** Added in this edit (it is not on the product yet). */
  isNew: boolean
  /** An existing one marked for deletion (deleted in the store on Save). */
  removed: boolean
}

/**
 * Metafields that are edited somewhere else on the page, so the Metafields tab only shows
 * them: the description sections (their own editor) and the SEO title / description (the
 * SEO card, which sends `seo`). Editing them in two places would fight.
 */
export function isManagedElsewhere(namespace: string, metaKey: string): boolean {
  return (
    (namespace === APD_NAMESPACE && metaKey === APD_KEY) ||
    (namespace === 'global' && (metaKey === 'title_tag' || metaKey === 'description_tag'))
  )
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
  /** With a changed handle: make the old address redirect to the new one. */
  redirectHandle: boolean
  templateSuffix: string
  /** The category's name; blank keeps the current one. */
  category: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  removedCollectionIds: string[]
  /** Names of the collections to put the product in (the API takes names). */
  addedCollections: string[]
  variants: VariantDraft[]
  /** The product's options, to rename (empty for a product with just a default variant). */
  options: OptionDraft[]
  /** Options to add to the product. */
  addedOptions: AddedOptionDraft[]
  /** Variants to add. */
  newVariants: NewVariantDraft[]
  /** Existing images in their current order (reordering changes this order). */
  images: ImageDraft[]
  /** The description sections (metafield apd), in order; [] when the product has none. */
  descriptionSections: SectionDraft[]
  /** The product's and its variants' metafields (those edited elsewhere are left out). */
  metafields: MetafieldEditDraft[]
}

/** The limits the API enforces (from its schema). */
export const LIMITS = {
  title: 255,
  vendor: 255,
  productType: 255,
  collectionName: 255,
  handle: 255,
  templateSuffix: 100,
  category: 120,
  seoTitle: 70,
  seoDescription: 320,
  sku: 255,
  barcode: 255,
  taxCode: 50,
  metafieldNamespace: 255,
  metafieldKey: 64,
  metafieldType: 64,
  metafieldValue: 65535,
  mediaUrl: 2000,
  mediaAlt: 512,
  /** Media the API attaches in one call (`POST /media`). */
  newMedia: 20,
  optionName: 255,
  optionValue: 255,
  /** A product has at most this many options, and this many variants. */
  options: 3,
  variants: 100,
} as const

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
    taxCode: '',
    inventoryPolicy: asInventoryPolicy(variant.inventory_policy),
    tracked: Boolean(variant.inventory_management),
    requiresShipping: variant.requires_shipping ?? true,
    cost: text(variant.cost),
    weight: text(variant.weight),
    weightUnit: asWeightUnit(variant.weight_unit),
    imageId: variantImageId(variant, images),
    hasImage: Boolean(variant.image_url),
    removeImage: false,
    stock: variant.inventory_levels.map((level) => ({
      key: `${variant.id}-stock-${level.location_shopify_id}`,
      locationId: String(level.location_shopify_id),
      available: text(level.available),
      originalLocationId: String(level.location_shopify_id),
      original: text(level.available),
    })),
    removed: false,
  }
}

/** The product's options as editable rows (a default-variant product has none worth renaming). */
export function draftOptions(product: ProductDetail): OptionDraft[] {
  if (product.has_only_default_variant) return []
  return product.options.map((option) => ({
    key: `option-${option.name}`,
    name: option.name,
    newName: option.name,
    values: option.values.map((value) => ({ from: value, to: value })),
  }))
}

/** A stock row for a location that has none yet. */
export function blankStockRow(): StockRowDraft {
  return {
    key: newKey('new-stock'),
    locationId: '',
    available: '',
    originalLocationId: '',
    original: '',
  }
}

/** The rows that carry stock to send: a location, a quantity, and a change (or a new row). */
function stockToSend(rows: StockRowDraft[], onlyChanged: boolean) {
  const sent = new Map<number, { location_id: number; available: number }>()
  for (const row of rows) {
    const available = row.available.trim()
    if (row.locationId === '' || available === '') continue
    if (
      onlyChanged &&
      row.locationId === row.originalLocationId &&
      available === row.original.trim()
    ) {
      continue
    }
    sent.set(Number(row.locationId), {
      location_id: Number(row.locationId),
      available: Number(available),
    })
  }
  return [...sent.values()]
}

export function blankAddedOption(): AddedOptionDraft {
  return { key: newKey('new-option'), name: '', values: [] }
}

export function blankNewVariant(weightUnit: WeightUnit = 'GRAMS'): NewVariantDraft {
  return {
    key: newKey('new-variant'),
    optionValues: [],
    price: '',
    compareAtPrice: '',
    sku: '',
    barcode: '',
    cost: '',
    weight: '',
    weightUnit,
    stock: [],
    imageUrl: '',
  }
}

/** The metafields the Metafields tab edits: the product's, then each variant's. */
export function draftMetafields(product: ProductDetail): MetafieldEditDraft[] {
  const toDraft = (
    variantId: string | null,
    field: {
      namespace: string
      key: string
      type?: string | null
      value?: string | null
    },
  ): MetafieldEditDraft => ({
    key: `${variantId ?? 'product'}:${field.namespace}.${field.key}`,
    variantId,
    namespace: field.namespace,
    metaKey: field.key,
    type: field.type || 'single_line_text_field',
    value: field.value ?? '',
    isNew: false,
    removed: false,
  })
  return [
    ...product.metafields
      .filter((field) => !isManagedElsewhere(field.namespace, field.key))
      .map((field) => toDraft(null, field)),
    ...product.variants.flatMap((variant) =>
      variant.metafields
        .filter((field) => !isManagedElsewhere(field.namespace, field.key))
        .map((field) => toDraft(variant.id, field)),
    ),
  ]
}

export function blankMetafieldEdit(): MetafieldEditDraft {
  return {
    key: newKey('new-metafield'),
    variantId: null,
    namespace: 'custom',
    metaKey: '',
    type: 'single_line_text_field',
    value: '',
    isNew: true,
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
    redirectHandle: true,
    templateSuffix: product.template_suffix ?? '',
    category: '',
    tags: [...product.tags],
    seoTitle: product.seo?.title ?? '',
    seoDescription: product.seo?.description ?? '',
    removedCollectionIds: [],
    addedCollections: [],
    variants: product.variants.map((variant) =>
      draftFromVariant(variant, product.images),
    ),
    options: draftOptions(product),
    addedOptions: [],
    newVariants: [],
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt_text ?? '',
    })),
    descriptionSections: draftSections(product),
    metafields: draftMetafields(product),
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
  // Only a typed code is sent (the current one is not known to the form).
  if (draft.taxCode.trim() !== '') set('tax_code', draft.taxCode.trim())
  if (draft.inventoryPolicy !== base.inventoryPolicy) {
    set('inventory_policy', draft.inventoryPolicy)
  }
  if (draft.tracked !== base.tracked) set('tracked', draft.tracked)
  if (draft.requiresShipping !== base.requiresShipping) {
    set('requires_shipping', draft.requiresShipping)
  }
  // "No image" takes the picture off the variant; otherwise only a different picture is sent
  // (the current one is preselected in the form).
  if (draft.removeImage) {
    if (base.hasImage) set('remove_image', true)
  } else if (draft.imageId && draft.imageId !== base.imageId) {
    set('image_attachment_id', draft.imageId)
  }
  // Only the locations whose quantity (or location) was changed; a blank box leaves the stock alone.
  const stock = stockToSend(draft.stock, true)
  if (stock.length) set('stock', stock)

  return changed ? edit : null
}

/** The options the product ends up with: its own, then the ones added in this edit. */
export function optionCount(draft: ProductDraft): number {
  return draft.options.length + draft.addedOptions.filter((o) => o.name.trim()).length
}

/** What each option's values can be picked from for a new variant (renamed values included). */
export function optionChoices(draft: ProductDraft): { name: string; values: string[] }[] {
  return [
    ...draft.options.map((option) => ({
      name: option.newName.trim() || option.name,
      values: option.values.map((value) => value.to.trim()).filter(Boolean),
    })),
    ...draft.addedOptions
      .filter((option) => option.name.trim())
      .map((option) => ({ name: option.name.trim(), values: option.values })),
  ]
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
  if (draft.handle.trim() !== product.handle) {
    body.handle = draft.handle.trim()
    // The old web address keeps working (a redirect) unless that was switched off.
    body.redirect_new_handle = draft.redirectHandle
  }
  if (draft.templateSuffix.trim() !== (product.template_suffix ?? '')) {
    body.template_suffix = draft.templateSuffix.trim()
  }
  // The current category isn't known to the form, so only a typed one is sent.
  if (draft.category.trim()) body.category = draft.category.trim()

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

  // Collections to add go by name (`collections_add`); ones the product is in, and repeats, are dropped.
  const inNames = new Set(
    product.collections.map((collection) => collectionKey(collection.title)),
  )
  const collectionsAdd: string[] = []
  for (const name of draft.addedCollections) {
    const key = collectionKey(name)
    if (!key || inNames.has(key)) continue
    inNames.add(key)
    collectionsAdd.push(name.trim())
  }
  if (collectionsAdd.length) body.collections_add = collectionsAdd
  // Collections come out by name, like they go in; the draft remembers which tiles were ticked by id.
  const leaving = new Set(draft.removedCollectionIds)
  const collectionsRemove = product.collections
    .filter((collection) => leaving.has(collection.id))
    .map((collection) => collection.title)
  if (collectionsRemove.length) body.collections_remove = collectionsRemove

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
  // Metafield changes: the product's go in `metafields` / `metafields_remove`, a variant's
  // in its own entry of `variants` (a removed variant's are moot).
  const productSets: ProductMetafieldInput[] = []
  const productRemoves: ProductMetafieldRemoval[] = []
  for (const field of draft.metafields) {
    const variant = field.variantId
      ? draft.variants.find((candidate) => candidate.id === field.variantId)
      : null
    if (field.variantId && (!variant || variant.removed)) continue

    const sets: ProductMetafieldInput[] = []
    const removes: ProductMetafieldRemoval[] = []
    if (field.isNew) {
      if (!field.removed) {
        sets.push({
          namespace: field.namespace.trim(),
          key: field.metaKey.trim(),
          type: field.type.trim(),
          value: field.value,
        })
      }
    } else {
      const existing = field.variantId
        ? product.variants.find((candidate) => candidate.id === field.variantId)
            ?.metafields
        : product.metafields
      const original = existing?.find(
        (candidate) =>
          candidate.namespace === field.namespace && candidate.key === field.metaKey,
      )
      if (!original) continue
      if (field.removed) {
        removes.push({ namespace: field.namespace, key: field.metaKey })
      } else if (field.value !== (original.value ?? '')) {
        // The type stays what it is: Shopify does not change a metafield's type in place.
        sets.push({
          namespace: field.namespace,
          key: field.metaKey,
          type: original.type || field.type,
          value: field.value,
        })
      }
    }
    if (sets.length === 0 && removes.length === 0) continue

    if (!field.variantId) {
      productSets.push(...sets)
      productRemoves.push(...removes)
      continue
    }
    let entry = variantEdits.find((candidate) => candidate.id === field.variantId)
    if (!entry) {
      entry = { id: field.variantId }
      variantEdits.push(entry)
    }
    if (sets.length) entry.metafields = [...(entry.metafields ?? []), ...sets]
    if (removes.length) {
      entry.metafields_remove = [...(entry.metafields_remove ?? []), ...removes]
    }
  }
  if (productSets.length) body.metafields = productSets
  if (productRemoves.length) body.metafields_remove = productRemoves

  // Options: a rename names the option as it is now; a value rename says from → to.
  const optionsUpdate: ProductOptionUpdate[] = []
  for (const option of draft.options) {
    const renames = option.values.flatMap((value) =>
      value.to.trim() !== '' && value.to.trim() !== value.from
        ? [{ from: value.from, to: value.to.trim() }]
        : [],
    )
    const newName = option.newName.trim()
    if (renames.length === 0 && (newName === '' || newName === option.name)) continue
    optionsUpdate.push({
      name: option.name,
      ...(newName !== '' && newName !== option.name ? { new_name: newName } : {}),
      ...(renames.length ? { values_rename: renames } : {}),
    })
  }
  if (optionsUpdate.length) body.options_update = optionsUpdate
  const optionsAdd = draft.addedOptions
    .filter((option) => option.name.trim() !== '' && option.values.length > 0)
    .map((option) => ({ name: option.name.trim(), values: option.values }))
  if (optionsAdd.length) body.options_add = optionsAdd

  // New variants copy tax, shipping and stock-tracking settings from the first one that stays.
  const sibling = draft.variants.find((variant) => !variant.removed)
  const total = optionCount(draft)
  for (const created of draft.newVariants) {
    const input: ProductVariantInput = {
      option_values: created.optionValues.slice(0, total).map((value) => value.trim()),
      price: created.price.trim(),
    }
    if (sibling) {
      input.taxable = sibling.taxable
      input.inventory_policy = sibling.inventoryPolicy
      input.tracked = sibling.tracked
      input.requires_shipping = sibling.requiresShipping
    }
    if (created.compareAtPrice.trim())
      input.compare_at_price = created.compareAtPrice.trim()
    if (created.sku.trim()) input.sku = created.sku.trim()
    if (created.barcode.trim()) input.barcode = created.barcode.trim()
    if (created.cost.trim()) input.cost = created.cost.trim()
    if (created.weight.trim()) {
      input.weight = created.weight.trim()
      input.weight_unit = created.weightUnit
    }
    const stock = stockToSend(created.stock, false)
    if (stock.length) input.stock = stock
    if (created.imageUrl.trim()) input.image_url = created.imageUrl.trim()
    variantEdits.push(input)
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
  if (sections) body.metafields = [...(body.metafields ?? []), sections]

  return body
}

export const hasChanges = (body: ProductUpdateBody) => Object.keys(body).length > 0

// --- Validation --------------------------------------------------------------------

/** A whole number, 0 or more. */
const WHOLE = /^\d+$/

/** Messages keyed by field path, e.g. `title`, `variants.2.price`, `newMedia.0.url`. */
export type DraftErrors = Record<string, string>

/** A list metafield holds a JSON array in its value, e.g. ["Plastic", "Paper"]. */
const isJsonArray = (value: string): boolean => {
  try {
    return Array.isArray(JSON.parse(value))
  } catch {
    return false
  }
}

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

/**
 * Checks a stock table: a quantity is a whole number and needs a location, and a location is
 * listed once. Keys: `<prefix>.<row>.location` and `<prefix>.<row>.quantity`.
 */
function validateStockRows(rows: StockRowDraft[], prefix: string, errors: DraftErrors) {
  const seen = new Set<string>()
  rows.forEach((row, index) => {
    const quantity = row.available.trim()
    const put = (field: string, message: string) => {
      if (!errors[`${prefix}.${index}.${field}`]) {
        errors[`${prefix}.${index}.${field}`] = message
      }
    }
    if (quantity !== '' && !WHOLE.test(quantity)) {
      put('quantity', 'Enter a whole number, 0 or more')
    }
    if (quantity !== '' && row.locationId === '') put('location', 'Choose a location')
    if (row.locationId !== '') {
      if (seen.has(row.locationId)) put('location', 'This location is already listed')
      seen.add(row.locationId)
    }
  })
}

/**
 * Checks the product's options (renames, added ones) and the variants being added. Keys:
 * `options.<i>.name`, `options.<i>.values.<j>`, `addedOptions.<i>.name` / `.values`,
 * `newVariants.<i>.<field>` and `newVariants` for the list as a whole.
 */
function validateOptionsAndNewVariants(
  product: ProductDetail,
  draft: ProductDraft,
  errors: DraftErrors,
) {
  const put = (key: string, message: string | null) => {
    if (message && !errors[key]) errors[key] = message
  }
  const lower = (value: string) => value.trim().toLowerCase()

  const names = new Set<string>()
  draft.options.forEach((option, index) => {
    const name = option.newName.trim()
    put(
      `options.${index}.name`,
      name === ''
        ? 'Enter a name'
        : (tooLong('The option name', name, LIMITS.optionName) ??
            (names.has(lower(name)) ? 'Two options have the same name' : null)),
    )
    names.add(lower(name))
    const seen = new Set<string>()
    option.values.forEach((value, valueIndex) => {
      const to = value.to.trim()
      put(
        `options.${index}.values.${valueIndex}`,
        to === ''
          ? 'Enter a value'
          : (tooLong('The value', to, LIMITS.optionValue) ??
              (seen.has(lower(to)) ? 'This value is already in the list' : null)),
      )
      seen.add(lower(to))
    })
  })

  draft.addedOptions.forEach((option, index) => {
    const name = option.name.trim()
    if (name === '' && option.values.length === 0) return
    put(
      `addedOptions.${index}.name`,
      name === ''
        ? 'Enter a name'
        : (tooLong('The option name', name, LIMITS.optionName) ??
            (names.has(lower(name))
              ? 'The product already has an option with this name'
              : null)),
    )
    names.add(lower(name))
    if (option.values.length === 0) {
      put(`addedOptions.${index}.values`, 'Add at least one value')
    } else if (option.values.some((value) => value.length > LIMITS.optionValue)) {
      put(
        `addedOptions.${index}.values`,
        `A value can be at most ${LIMITS.optionValue} characters`,
      )
    }
  })
  if (optionCount(draft) > LIMITS.options) {
    errors.addedOptions = `A product can have at most ${LIMITS.options} options`
  }

  if (draft.newVariants.length === 0) return
  const kept = draft.variants.filter((variant) => !variant.removed).length
  if (kept + draft.newVariants.length > LIMITS.variants) {
    errors.newVariants = `A product can have at most ${LIMITS.variants} variants`
  }

  // The values of the variants already there, as they will read after any renames — only
  // comparable when no option is being added (they would have no value for it).
  const choices = optionChoices(draft)
  const addingOptions = draft.addedOptions.some((option) => option.name.trim() !== '')
  const taken = new Set<string>()
  if (!addingOptions) {
    for (const variant of product.variants) {
      if (draft.variants.find((candidate) => candidate.id === variant.id)?.removed)
        continue
      taken.add(
        JSON.stringify(
          draft.options.map((option) => {
            const value =
              variant.selected_options?.find((chosen) => chosen.name === option.name)
                ?.value ?? ''
            return lower(option.values.find((pair) => pair.from === value)?.to ?? value)
          }),
        ),
      )
    }
  }

  draft.newVariants.forEach((created, index) => {
    const at = (field: string) => `newVariants.${index}.${field}`
    if (choices.length === 0) {
      put(
        at('options'),
        'Add an option first (for example Size), then give this variant a value for it',
      )
    }
    choices.forEach((choice, position) => {
      put(
        at(`optionValues.${position}`),
        (created.optionValues[position] ?? '').trim() === ''
          ? `Choose a ${choice.name || 'value'}`
          : tooLong('The value', created.optionValues[position], LIMITS.optionValue),
      )
    })
    if (choices.length > 0 && !addingOptions) {
      const values = choices.map((_, position) =>
        lower(created.optionValues[position] ?? ''),
      )
      const combo = JSON.stringify(values)
      if (values.some(Boolean) && taken.has(combo)) {
        put(at('options'), 'A variant with these values already exists')
      }
      taken.add(combo)
    }
    put(
      at('price'),
      created.price.trim() === ''
        ? 'Enter a price'
        : isDecimal(created.price)
          ? null
          : 'Enter a number, 0 or more',
    )
    for (const [field, label, value] of [
      ['compareAtPrice', 'Compare-at price', created.compareAtPrice],
      ['cost', 'Cost', created.cost],
      ['weight', 'Weight', created.weight],
    ] as const) {
      if (value.trim() !== '' && !isDecimal(value)) {
        put(at(field), `${label}: enter a number, 0 or more`)
      }
    }
    put(at('sku'), tooLong('The SKU', created.sku, LIMITS.sku))
    put(at('barcode'), tooLong('The barcode', created.barcode, LIMITS.barcode))
    const url = created.imageUrl.trim()
    if (url !== '') {
      put(
        at('imageUrl'),
        !/^https:\/\//i.test(url)
          ? 'Use a public https:// address'
          : url.length > LIMITS.mediaUrl
            ? `The address can be at most ${LIMITS.mediaUrl} characters`
            : null,
      )
    }
    validateStockRows(created.stock, at('stock'), errors)
  })
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
  put('category', tooLong('The category', draft.category, LIMITS.category))
  put('seoTitle', tooLong('The SEO title', draft.seoTitle, LIMITS.seoTitle))
  put(
    'seoDescription',
    tooLong('The SEO description', draft.seoDescription, LIMITS.seoDescription),
  )

  draft.addedCollections.forEach((name, index) => {
    put(
      `addedCollections.${index}`,
      name.trim() === '' || name.trim().length > LIMITS.collectionName
        ? 'Not a valid collection name'
        : null,
    )
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
    put(at('taxCode'), tooLong('The tax code', variant.taxCode, LIMITS.taxCode))
    put(at('sku'), tooLong('The SKU', variant.sku, LIMITS.sku))
    put(at('barcode'), tooLong('The barcode', variant.barcode, LIMITS.barcode))
    validateStockRows(variant.stock, `variants.${index}.stock`, errors)
  })

  validateOptionsAndNewVariants(product, draft, errors)

  draft.images.forEach((image, index) => {
    put(`images.${index}.alt`, tooLong('The alt text', image.alt, LIMITS.mediaAlt))
  })

  // Metafields: only a changed or new one is checked, so an odd value already in the store
  // never blocks an unrelated change.
  const taken = new Set<string>()
  draft.metafields.forEach((field, index) => {
    const at = (name: string) => `metafields.${index}.${name}`
    if (field.removed) return
    const original = field.isNew
      ? null
      : (field.variantId
          ? product.variants.find((variant) => variant.id === field.variantId)?.metafields
          : product.metafields
        )?.find(
          (candidate) =>
            candidate.namespace === field.namespace && candidate.key === field.metaKey,
        )
    const changed = field.isNew || field.value !== (original?.value ?? '')
    if (!changed) return

    if (field.isNew) {
      const name = `${field.variantId ?? ''}:${field.namespace.trim()}.${field.metaKey.trim()}`
      put(
        at('namespace'),
        field.namespace.trim()
          ? tooLong('The namespace', field.namespace, LIMITS.metafieldNamespace)
          : 'Enter a namespace',
      )
      put(
        at('metaKey'),
        field.metaKey.trim()
          ? (tooLong('The key', field.metaKey, LIMITS.metafieldKey) ??
              (isManagedElsewhere(field.namespace.trim(), field.metaKey.trim())
                ? 'This detail is edited in the Description or SEO card'
                : taken.has(name) ||
                    product.metafields.some(
                      (candidate) =>
                        candidate.namespace === field.namespace.trim() &&
                        candidate.key === field.metaKey.trim(),
                    )
                  ? 'The product already has this detail'
                  : null))
          : 'Enter a key',
      )
      taken.add(name)
      put(
        at('type'),
        field.type.trim()
          ? tooLong('The type', field.type, LIMITS.metafieldType)
          : 'Choose a type',
      )
    }
    put(
      at('value'),
      field.value.trim()
        ? (tooLong('The value', field.value, LIMITS.metafieldValue) ??
            (field.type.startsWith('list.') && !isJsonArray(field.value)
              ? 'A list needs a JSON array: values in square brackets, e.g. ["Plastic", "Paper"]'
              : null))
        : 'Enter a value, or remove this detail',
    )
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
