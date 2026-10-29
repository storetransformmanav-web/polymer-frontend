import type {
  InventoryPolicy,
  ProductCreateBody,
  ProductCreateResult,
  ProductCreateVariantInput,
  ProductEditStatus,
  ProductMediaInput,
  ProductListItem,
  WeightUnit,
} from '../../../lib/api/endpoints.ts'
import {
  buildMediaItems,
  LIMITS,
  newKey,
  type DraftErrors,
  type NewMediaDraft,
} from './editDraft.ts'

/**
 * The "Add product" form's working copy, and the pure steps around it: variants
 * follow the options, `validateCreateDraft` checks everything against the API's
 * limits before anything is sent, `buildCreateBody` turns the form into the
 * request, and `buildListItem` makes the row the new product shows as in the
 * list the moment it exists.
 */

/** The limits the API enforces on a new product (from its schema). */
export const CREATE_LIMITS = {
  options: 3,
  optionValues: 100,
  variants: 100,
  media: 50,
  metafields: 50,
  metafieldKey: 64,
  metafieldType: 64,
  metafieldNamespace: 255,
  metafieldValue: 65535,
  taxCode: 50,
} as const

/** Metafield types the form offers (Shopify's common ones). */
export const METAFIELD_TYPES = [
  'single_line_text_field',
  'multi_line_text_field',
  'number_integer',
  'number_decimal',
  'boolean',
  'url',
  'json',
  'date',
  'date_time',
  'color',
  'rich_text_field',
  // A list holds a JSON array in the value, e.g. ["Plastic", "Paper"].
  'list.single_line_text_field',
  'list.number_integer',
  'list.number_decimal',
  'list.url',
  'list.date',
  'list.color',
] as const

export interface CreateOptionDraft {
  key: string
  /** "Size", "Colour"… */
  name: string
  values: string[]
}

export interface CreateVariantDraft {
  key: string
  /** One value per option, in option order; empty for a product without options. */
  optionValues: string[]
  price: string
  compareAtPrice: string
  cost: string
  /** This variant's weight, in the product's weight unit ('' = none). */
  weight: string
  sku: string
  barcode: string
  /** Opening stock at the chosen location ('' = none given). */
  stock: string
  /**
   * A public https address of the picture to show for this variant ('' = none).
   * The API needs it in the product's `media` too, so one that isn't listed there
   * is added to the media on create (see `buildCreateBody`).
   */
  imageUrl: string
}

export interface MetafieldDraft {
  key: string
  namespace: string
  metaKey: string
  type: string
  value: string
}

export interface CreateDraft {
  /** Store key the product is created in. */
  shop: string
  title: string
  descriptionHtml: string
  vendor: string
  productType: string
  status: ProductEditStatus
  handle: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  templateSuffix: string
  categoryGid: string
  giftCard: boolean
  options: CreateOptionDraft[]
  variants: CreateVariantDraft[]
  /** What every variant shares. */
  taxable: boolean
  /** Tax code ('' = none). */
  taxCode: string
  requiresShipping: boolean
  tracked: boolean
  inventoryPolicy: InventoryPolicy
  /** The unit every variant's weight is in. */
  weightUnit: WeightUnit
  /** Shopify location the opening stock goes to ('' = no stock given). */
  locationId: string
  media: NewMediaDraft[]
  /** CRM collection ids. */
  collections: string[]
  metafields: MetafieldDraft[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DECIMAL = /^\d+(\.\d+)?$/
const INTEGER = /^\d+$/

export function blankVariant(optionValues: string[] = []): CreateVariantDraft {
  return {
    key: newKey('create-variant'),
    optionValues,
    price: '',
    compareAtPrice: '',
    cost: '',
    weight: '',
    sku: '',
    barcode: '',
    stock: '',
    imageUrl: '',
  }
}

export function blankOption(): CreateOptionDraft {
  return { key: newKey('create-option'), name: '', values: [] }
}

export function blankMetafield(): MetafieldDraft {
  return {
    key: newKey('create-metafield'),
    namespace: 'custom',
    metaKey: '',
    type: 'single_line_text_field',
    value: '',
  }
}

export function blankCreateDraft(shop: string): CreateDraft {
  return {
    shop,
    title: '',
    descriptionHtml: '',
    vendor: '',
    productType: '',
    status: 'DRAFT',
    handle: '',
    tags: [],
    seoTitle: '',
    seoDescription: '',
    templateSuffix: '',
    categoryGid: '',
    giftCard: false,
    options: [],
    variants: [blankVariant()],
    taxable: true,
    taxCode: '',
    requiresShipping: true,
    tracked: true,
    inventoryPolicy: 'DENY',
    weightUnit: 'KILOGRAMS',
    locationId: '',
    media: [],
    collections: [],
    metafields: [],
  }
}

// --- Options → variants ----------------------------------------------------------

/** The options that count: a name and at least one value. */
const usableOptions = (options: CreateOptionDraft[]) =>
  options.filter((option) => option.name.trim() !== '' && option.values.length > 0)

/** Every combination of the options' values — one variant each (one empty combination without options). */
export function variantCombinations(options: CreateOptionDraft[]): string[][] {
  return usableOptions(options).reduce<string[][]>(
    (combos, option) =>
      combos.flatMap((combo) => option.values.map((value) => [...combo, value])),
    [[]],
  )
}

const comboKey = (values: string[]) => values.join('\u0001')

/**
 * Re-derives the variants from the options, keeping what was already typed for a
 * combination that still exists. A new combination starts with the first
 * variant's price, compare-at price, cost and weight (as the store admin does),
 * so adding a value to "Size" doesn't mean typing the price again.
 */
export function syncVariants(draft: CreateDraft): CreateDraft {
  const existing = new Map(
    draft.variants.map((variant) => [comboKey(variant.optionValues), variant]),
  )
  const seed = draft.variants[0]

  const variants = variantCombinations(draft.options).map((values) => {
    const kept = existing.get(comboKey(values))
    if (kept) return kept
    const fresh = blankVariant(values)
    if (seed) {
      fresh.price = seed.price
      fresh.compareAtPrice = seed.compareAtPrice
      fresh.cost = seed.cost
      fresh.weight = seed.weight
    }
    return fresh
  })
  return { ...draft, variants }
}

// --- Has anything been entered? ------------------------------------------------------

/** True once the user has typed or chosen anything (so leaving asks first). */
export function isCreateDirty(draft: CreateDraft): boolean {
  return (
    [
      draft.title,
      draft.descriptionHtml,
      draft.vendor,
      draft.productType,
      draft.handle,
      draft.seoTitle,
      draft.seoDescription,
      draft.templateSuffix,
      draft.categoryGid,
      draft.taxCode,
    ].some((value) => value.trim() !== '') ||
    draft.tags.length > 0 ||
    draft.collections.length > 0 ||
    draft.options.length > 0 ||
    draft.giftCard ||
    draft.status !== 'DRAFT' ||
    draft.media.some((row) => row.url.trim() !== '' || row.alt.trim() !== '') ||
    draft.metafields.some(
      (field) => field.metaKey.trim() !== '' || field.value.trim() !== '',
    ) ||
    draft.variants.some((variant) =>
      [
        variant.price,
        variant.compareAtPrice,
        variant.cost,
        variant.weight,
        variant.sku,
        variant.barcode,
        variant.stock,
        variant.imageUrl,
      ].some((value) => value.trim() !== ''),
    )
  )
}

// --- Validation ------------------------------------------------------------------------

const tooLong = (label: string, value: string, max: number) =>
  value.trim().length > max ? `${label} can be at most ${max} characters` : null

const isJsonArray = (value: string): boolean => {
  try {
    return Array.isArray(JSON.parse(value))
  } catch {
    return false
  }
}

/** Checks the draft against the API's limits. An empty result means it can be sent. */
export function validateCreateDraft(draft: CreateDraft): DraftErrors {
  const errors: DraftErrors = {}
  const put = (key: string, message: string | null) => {
    if (message) errors[key] = message
  }

  put('shop', draft.shop ? null : 'Choose the store to create the product in')
  put('title', draft.title.trim() ? null : 'Enter a title')
  put('title', errors.title ?? tooLong('The title', draft.title, LIMITS.title))
  put('vendor', tooLong('The vendor', draft.vendor, LIMITS.vendor))
  put('productType', tooLong('The product type', draft.productType, LIMITS.productType))
  put('handle', tooLong('The handle', draft.handle, LIMITS.handle))
  put(
    'templateSuffix',
    tooLong('The template suffix', draft.templateSuffix, LIMITS.templateSuffix),
  )
  put('categoryGid', tooLong('The category ID', draft.categoryGid, LIMITS.category))
  put('seoTitle', tooLong('The SEO title', draft.seoTitle, LIMITS.seoTitle))
  put(
    'seoDescription',
    tooLong('The SEO description', draft.seoDescription, LIMITS.seoDescription),
  )

  // Options
  if (draft.options.length > CREATE_LIMITS.options) {
    errors.options = `A product can have at most ${CREATE_LIMITS.options} options`
  }
  const seenNames = new Set<string>()
  draft.options.forEach((option, index) => {
    const name = option.name.trim()
    if (name === '' && option.values.length === 0) return
    if (name === '') errors[`options.${index}.name`] = 'Name this option (Size, Colour…)'
    else if (name.length > 255)
      errors[`options.${index}.name`] = 'The name can be at most 255 characters'
    else if (seenNames.has(name.toLowerCase()))
      errors[`options.${index}.name`] = 'Each option needs a different name'
    seenNames.add(name.toLowerCase())
    if (option.values.length === 0)
      errors[`options.${index}.values`] = 'Add at least one value'
    else if (option.values.length > CREATE_LIMITS.optionValues) {
      errors[`options.${index}.values`] = `At most ${CREATE_LIMITS.optionValues} values`
    }
  })
  if (draft.variants.length > CREATE_LIMITS.variants) {
    errors.variants = `These options make ${draft.variants.length} variants — at most ${CREATE_LIMITS.variants} are allowed. Remove some values.`
  }
  if (draft.variants.length === 0)
    errors.variants = 'A product needs at least one variant'

  put('taxCode', tooLong('The tax code', draft.taxCode, CREATE_LIMITS.taxCode))

  // Variants
  draft.variants.forEach((variant, index) => {
    const at = (field: string) => `variants.${index}.${field}`
    const price = variant.price.trim()
    put(
      at('price'),
      price === ''
        ? 'Enter a price'
        : DECIMAL.test(price)
          ? null
          : 'Enter a price, for example 9.99',
    )
    for (const [field, label, value] of [
      ['compareAtPrice', 'Compare-at price', variant.compareAtPrice],
      ['cost', 'Cost', variant.cost],
      ['weight', 'Weight', variant.weight],
    ] as const) {
      if (value.trim() !== '' && !DECIMAL.test(value.trim()))
        put(at(field), `${label}: enter a number such as 12.50`)
    }
    put(at('sku'), tooLong('The SKU', variant.sku, LIMITS.sku))
    put(at('barcode'), tooLong('The barcode', variant.barcode, LIMITS.barcode))
    if (
      draft.locationId &&
      variant.stock.trim() !== '' &&
      !INTEGER.test(variant.stock.trim())
    ) {
      put(at('stock'), 'Enter a whole number, such as 25')
    }
    const imageUrl = variant.imageUrl.trim()
    if (imageUrl !== '') {
      put(
        at('imageUrl'),
        imageUrl.length > LIMITS.mediaUrl
          ? `The address can be at most ${LIMITS.mediaUrl} characters`
          : /^https:\/\/\S+$/i.test(imageUrl)
            ? null
            : 'Use a public link that starts with https://',
      )
    }
  })
  // The variants' pictures are added to the media list, which has its own limit.
  const mediaCount = new Set([
    ...draft.media.map((row) => row.url.trim()).filter(Boolean),
    ...draft.variants.map((variant) => variant.imageUrl.trim()).filter(Boolean),
  ]).size
  if (mediaCount > CREATE_LIMITS.media) {
    errors['media.rows'] =
      `Uploaded media and variant images together can be at most ${CREATE_LIMITS.media} files`
  }
  if (draft.locationId !== '' && !INTEGER.test(draft.locationId)) {
    errors.locationId = 'The location ID is a number (digits only)'
  }

  // Media (blank rows are skipped; the rest need https addresses)
  const filledMedia = draft.media.filter(
    (row) => row.url.trim() !== '' || row.alt.trim() !== '',
  )
  if (filledMedia.length > CREATE_LIMITS.media) {
    errors['media.rows'] = `You can add at most ${CREATE_LIMITS.media} files`
  }
  draft.media.forEach((row, index) => {
    const url = row.url.trim()
    if (url === '' && row.alt.trim() === '') return
    put(
      `media.${index}.url`,
      url === ''
        ? 'Enter the file’s web address'
        : url.length > LIMITS.mediaUrl
          ? `The address can be at most ${LIMITS.mediaUrl} characters`
          : /^https:\/\//i.test(url)
            ? null
            : 'Use a public link that starts with https://',
    )
    put(`media.${index}.alt`, tooLong('The alt text', row.alt, LIMITS.mediaAlt))
  })

  // Collections
  draft.collections.forEach((id, index) => {
    put(`collections.${index}`, UUID.test(id) ? null : 'Not a valid collection ID')
  })

  // Metafields (a row with nothing typed is skipped)
  const filledMetafields = draft.metafields.filter(
    (field) => field.metaKey.trim() !== '' || field.value.trim() !== '',
  )
  if (filledMetafields.length > CREATE_LIMITS.metafields) {
    errors.metafields = `At most ${CREATE_LIMITS.metafields} metafields`
  }
  draft.metafields.forEach((field, index) => {
    const at = (name: string) => `metafields.${index}.${name}`
    if (field.metaKey.trim() === '' && field.value.trim() === '') return
    put(
      at('namespace'),
      field.namespace.trim()
        ? tooLong('The namespace', field.namespace, CREATE_LIMITS.metafieldNamespace)
        : 'Enter a namespace',
    )
    put(
      at('metaKey'),
      field.metaKey.trim()
        ? tooLong('The key', field.metaKey, CREATE_LIMITS.metafieldKey)
        : 'Enter a key',
    )
    put(
      at('type'),
      field.type.trim()
        ? tooLong('The type', field.type, CREATE_LIMITS.metafieldType)
        : 'Choose a type',
    )
    put(
      at('value'),
      field.value.trim()
        ? (tooLong('The value', field.value, CREATE_LIMITS.metafieldValue) ??
            (field.type.startsWith('list.') && !isJsonArray(field.value)
              ? 'A list needs a JSON array: values in square brackets, e.g. ["Plastic", "Paper"]'
              : null))
        : 'Enter a value',
    )
  })

  return errors
}

// --- Draft → request -----------------------------------------------------------------------

const trimmed = (value: string) => value.trim()

/**
 * The product's `media` as sent: the files listed under Media, then — because the
 * API wants a variant's picture listed in `media` as well — any variant picture
 * that isn't there yet (once each, so the featured image stays the first one).
 */
function createMedia(draft: CreateDraft): ProductMediaInput[] {
  const media = buildMediaItems(draft.media)
  const listed = new Set(media.map((item) => item.url))
  for (const variant of draft.variants) {
    const url = trimmed(variant.imageUrl)
    if (url !== '' && !listed.has(url)) {
      listed.add(url)
      media.push({ url, media_type: 'IMAGE' })
    }
  }
  return media
}

/** The `POST /products` body for a draft that passed `validateCreateDraft`. */
export function buildCreateBody(draft: CreateDraft): ProductCreateBody {
  const body: ProductCreateBody = {
    shop: draft.shop,
    title: trimmed(draft.title),
    status: draft.status,
    gift_card: draft.giftCard,
    variants: draft.variants.map((variant) => {
      const input: ProductCreateVariantInput = {
        price: trimmed(variant.price),
        taxable: draft.taxable,
        inventory_policy: draft.inventoryPolicy,
        tracked: draft.tracked,
        requires_shipping: draft.requiresShipping,
      }
      if (trimmed(draft.taxCode)) input.tax_code = trimmed(draft.taxCode)
      if (variant.optionValues.length > 0) input.option_values = variant.optionValues
      if (trimmed(variant.compareAtPrice))
        input.compare_at_price = trimmed(variant.compareAtPrice)
      if (trimmed(variant.cost)) input.cost = trimmed(variant.cost)
      if (trimmed(variant.sku)) input.sku = trimmed(variant.sku)
      if (trimmed(variant.barcode)) input.barcode = trimmed(variant.barcode)
      if (trimmed(variant.weight)) {
        input.weight = trimmed(variant.weight)
        input.weight_unit = draft.weightUnit
      }
      if (draft.locationId && trimmed(variant.stock) !== '') {
        input.stock = [
          {
            location_id: Number(draft.locationId),
            available: Number(trimmed(variant.stock)),
          },
        ]
      }
      if (trimmed(variant.imageUrl)) input.image_url = trimmed(variant.imageUrl)
      return input
    }),
  }

  if (draft.descriptionHtml.trim()) body.description_html = draft.descriptionHtml
  if (trimmed(draft.vendor)) body.vendor = trimmed(draft.vendor)
  if (trimmed(draft.productType)) body.product_type = trimmed(draft.productType)
  if (trimmed(draft.handle)) body.handle = trimmed(draft.handle)
  if (draft.tags.length > 0) body.tags = draft.tags
  if (trimmed(draft.seoTitle) || trimmed(draft.seoDescription)) {
    body.seo = {
      ...(trimmed(draft.seoTitle) ? { title: trimmed(draft.seoTitle) } : {}),
      ...(trimmed(draft.seoDescription)
        ? { description: trimmed(draft.seoDescription) }
        : {}),
    }
  }
  if (trimmed(draft.templateSuffix)) body.template_suffix = trimmed(draft.templateSuffix)
  if (trimmed(draft.categoryGid)) body.category_gid = trimmed(draft.categoryGid)

  const options = usableOptions(draft.options).map((option) => ({
    name: trimmed(option.name),
    values: option.values,
  }))
  if (options.length > 0) body.options = options

  const media = createMedia(draft)
  if (media.length > 0) body.media = media
  if (draft.collections.length > 0) body.collections = draft.collections

  const metafields = draft.metafields
    .filter((field) => field.metaKey.trim() !== '' || field.value.trim() !== '')
    .map((field) => ({
      namespace: trimmed(field.namespace),
      key: trimmed(field.metaKey),
      type: trimmed(field.type),
      value: field.value,
    }))
  if (metafields.length > 0) body.metafields = metafields

  return body
}

// --- Answer → list row ------------------------------------------------------------------------

/** The store the product was created in, as the list shows it. */
export interface CreatedShop {
  key?: string | null
  name?: string | null
  domain?: string | null
  currency?: string | null
}

const price = (value: number) => value.toFixed(2)

/**
 * The first image address that will be sent (the product's own media, else a
 * variant's picture) — what the new product shows until the store has downloaded
 * the file and the CRM has its own copy's address.
 */
export function firstImageUrl(draft: CreateDraft): string | null {
  const image = createMedia(draft).find((item) => item.media_type === 'IMAGE')
  return image ? image.url : null
}

/**
 * The row the new product shows as in the products list, built from the form
 * and the answer — so it is on screen at once, before the list is read again.
 */
export function buildListItem(
  draft: CreateDraft,
  result: ProductCreateResult,
  shop: CreatedShop | null,
): ProductListItem {
  const prices = draft.variants
    .map((variant) => Number(variant.price))
    .filter(Number.isFinite)
  const stocked =
    draft.tracked && draft.locationId
      ? draft.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0)
      : null

  return {
    shop: shop ?? { key: draft.shop },
    id: result.product_id,
    shopify_id: result.shopify_id ?? 0,
    title: result.title || draft.title.trim(),
    handle: result.handle || draft.handle.trim(),
    status: result.status || draft.status,
    vendor: draft.vendor.trim() || null,
    product_type: draft.productType.trim() || null,
    category_name: null,
    tags: draft.tags,
    image_url: firstImageUrl(draft),
    price_min: prices.length ? price(Math.min(...prices)) : null,
    price_max: prices.length ? price(Math.max(...prices)) : null,
    currency: shop?.currency ?? null,
    variants_count: result.variants || draft.variants.length,
    total_inventory: stocked,
    shopify_created_at: null,
    shopify_updated_at: null,
    synced_at: new Date().toISOString(),
  }
}
