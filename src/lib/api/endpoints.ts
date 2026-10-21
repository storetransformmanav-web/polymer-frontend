import { z } from 'zod'
import { apiClient } from './client.ts'

/**
 * Every backend endpoint the app calls lives in this one file: the path,
 * the Zod schema for its response, and the function that performs the
 * request. Redux thunks (src/app/store/*Slice.ts) call these functions —
 * nothing else in the app talks to `apiClient` directly.
 *
 * Paths are relative to `VITE_API_BASE_URL` (see src/config/env.ts).
 * Add a new endpoint here: path in `ENDPOINTS`, schema below, function in
 * `api`.
 */
export const ENDPOINTS = {
  auth: {
    requestOtp: '/auth/otp/request',
    verifyOtp: '/auth/otp/verify',
    google: '/auth/google',
    logout: '/auth/logout',
  },
  shops: {
    list: '/shops',
  },
  users: {
    list: '/users',
    create: '/users',
  },
  roles: {
    list: '/roles',
  },
  activity: {
    list: '/activity',
    /** Distinct action names with counts — feeds the action dropdown. */
    actions: '/activity/actions',
  },
  customers: {
    list: '/customers',
    /** `ref` is the customer's UUID, Shopify ID or email. */
    detail: (ref: string) => `/customers/${encodeURIComponent(ref)}`,
  },
  inventory: {
    /** `GET` the stock list — also names the stores' stock locations. */
    list: '/inventory',
  },
  sync: {
    /** `POST` starts a background sync of every product of one store. */
    products: '/sync/products',
    /** `GET` the recent sync runs (progress and result). */
    status: '/sync/status',
  },
  products: {
    list: '/products',
    /** `ref` is the product's UUID or Shopify ID. */
    detail: (ref: string) => `/products/${encodeURIComponent(ref)}`,
    /** `id` is the product's CRM UUID (`PUT` edits it). */
    update: (id: string) => `/products/${encodeURIComponent(id)}`,
    /** `DELETE` removes the product (the backend archives it by default); `id` is its CRM UUID. */
    remove: (id: string) => `/products/${encodeURIComponent(id)}`,
    /** `POST` creates a product (in Shopify first, then read back into the CRM). */
    create: '/products',
    /** `POST` attaches images/videos by public URL (`id` is the product's CRM UUID). */
    media: (id: string) => `/products/${encodeURIComponent(id)}/media`,
    /** `DELETE` removes one media attachment (its CRM UUID) from the product. */
    mediaItem: (id: string, attachmentId: string) =>
      `/products/${encodeURIComponent(id)}/media/${encodeURIComponent(attachmentId)}`,
    /** Retry the latest failed or pending push of this product to its store. */
    push: (id: string) => `/products/${encodeURIComponent(id)}/push`,
    /** History of this product's pushes to its store, newest first. */
    sync: (id: string) => `/products/${encodeURIComponent(id)}/sync`,
  },
} as const

// ---------------------------------------------------------------------------
// Schemas — the source of truth for response types (derive with z.infer)
// ---------------------------------------------------------------------------

/** What a user may do in one area (users, products, orders…) — as the backend reports it. */
const featureAccessSchema = z.object({
  view: z.boolean().optional(),
  manage: z.boolean().optional(),
})

const authUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.string(),
  is_active: z.boolean(),
  last_login_at: z.string().nullable(),
  /** The user's access by area (`products`, `users`…). Not used to hide anything yet. */
  permissions: z.record(z.string(), featureAccessSchema).optional(),
})

/**
 * Sent with every sign-in: `true` = the backend issues a 30-day token, `false` (its
 * default when left out) = a 1-day one. The app lets every sign-in last 30 days (see
 * "Staying signed in" in CLAUDE.md), so it always asks for the long one.
 */
const STAY_SIGNED_IN = true

const otpRequestResponseSchema = z.object({
  message: z.string(),
  expires_in_seconds: z.number().default(600),
  /**
   * Only sent by development backends, e.g. "No active user with this email
   * (this note only appears in development)." Production never includes it
   * (the generic message above deliberately doesn't reveal whether the
   * account exists).
   */
  dev_note: z.string().optional(),
})

// --- Shops (GET /shops) --------------------------------------------------------
// The stores the signed-in user may see, in dropdown order. Optional-ish fields
// are `.nullish()` so one missing value can't take the whole dropdown down.

const shopSchema = z.object({
  id: z.string(),
  /** Short store key, e.g. "polymer-uk" — what `shop=` filters take. */
  key: z.string().nullish(),
  name: z.string().nullish(),
  domain: z.string(),
  primary_domain: z.string().nullish(),
  currency: z.string().nullish(),
  timezone: z.string().nullish(),
  colour: z.string().nullish(),
  is_active: z.boolean().default(true),
  position: z.number().default(0),
  connected: z.boolean().default(true),
  products_count: z.number().default(0),
  last_synced_at: z.string().nullish(),
})

const shopListResponseSchema = z.object({
  items: z.array(shopSchema),
  total: z.number().default(0),
})

// --- Users (GET/POST /users) and roles (GET /roles) ---------------------------
// CRM staff accounts. They sign in with an emailed code or Google — no password.

export const USER_STATUSES = ['active', 'inactive'] as const

const userItemSchema = z.object({
  id: z.string(),
  first_name: z.string().default(''),
  last_name: z.string().default(''),
  full_name: z.string().default(''),
  email: z.string(),
  phone: z.string().nullish(),
  /** The role's name (what `role=` filters and create/update take), e.g. "office". */
  role: z.string(),
  /** The role's display name, e.g. "Office". */
  role_label: z.string().nullish(),
  is_active: z.boolean(),
  google_linked: z.boolean().default(false),
  last_login_at: z.string().nullish(),
  created_at: z.string().nullish(),
  /** Keys of the stores a non-admin user may see (admins see every store). */
  shop_keys: z.array(z.string()).default([]),
})

const userListResponseSchema = z.object({
  items: z.array(userItemSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  total_pages: z.number(),
  has_next: z.boolean(),
})

const userCreateResponseSchema = z.object({ user: userItemSchema })

const roleSchema = z.object({
  name: z.string(),
  label: z.string(),
  description: z.string().nullish(),
  is_system: z.boolean().default(false),
  users_count: z.number().default(0),
})

const roleListResponseSchema = z.object({ items: z.array(roleSchema) })

export type UserStatus = (typeof USER_STATUSES)[number]
export type UserItem = z.infer<typeof userItemSchema>
export type UserListResponse = z.infer<typeof userListResponseSchema>
export type Role = z.infer<typeof roleSchema>

/** Query parameters accepted by `GET /users` (all optional). */
export interface UserListParams {
  /** Name or email. */
  search?: string
  /** A role name from `GET /roles`. */
  role?: string
  status?: UserStatus
  page?: number
  /** 1–100. */
  page_size?: number
}

/** Body of `POST /users`. */
export interface UserCreateBody {
  first_name: string
  last_name?: string
  email: string
  /** A role name from `GET /roles`. */
  role?: string
  phone?: string | null
  /** Stores a non-admin user may see. */
  shop_keys?: string[]
}

// --- Activity log (GET /activity, GET /activity/actions) -----------------------
// A record of what staff did in the CRM. `details` and `changes` are free-form
// JSON from the backend: they are only ever shown as text, never as markup.

export const ACTIVITY_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const activityUserSchema = z.object({
  id: z.string().nullish(),
  full_name: z.string().nullish(),
  email: z.string().nullish(),
  role: z.string().nullish(),
})

const activityItemSchema = z.object({
  id: z.number(),
  time: z.string(),
  user: activityUserSchema.nullish(),
  /** Machine name, e.g. "list_products" — what the `action` filter takes. */
  action: z.string(),
  /** A sentence, e.g. "Manav viewed the products list". */
  summary: z.string().default(''),
  method: z.string().nullish(),
  path: z.string().nullish(),
  entity_type: z.string().nullish(),
  entity_id: z.string().nullish(),
  entity_label: z.string().nullish(),
  details: z.record(z.string(), z.unknown()).nullish(),
  changes: z.record(z.string(), z.unknown()).nullish(),
  status_code: z.number().nullish(),
  duration_ms: z.number().nullish(),
  ip: z.string().nullish(),
  device: z.string().nullish(),
})

const activityListResponseSchema = z.object({
  items: z.array(activityItemSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  total_pages: z.number(),
  has_next: z.boolean(),
})

const activityActionSchema = z.object({ action: z.string(), count: z.number() })
const activityActionsResponseSchema = z.object({ items: z.array(activityActionSchema) })

export type ActivityMethod = (typeof ACTIVITY_METHODS)[number]
export type ActivityItem = z.infer<typeof activityItemSchema>
export type ActivityListResponse = z.infer<typeof activityListResponseSchema>
export type ActivityActionCount = z.infer<typeof activityActionSchema>

/** Query parameters accepted by `GET /activity` (all optional). */
export interface ActivityListParams {
  /** Only this user (omit for everyone). */
  user_id?: string
  /** Exact action name, e.g. "update_user". */
  action?: string
  entity_type?: string
  entity_id?: string
  method?: ActivityMethod
  /** Matches the summary text or the path. */
  search?: string
  /** ISO date-time, inclusive start. */
  from?: string
  /** ISO date-time, end. */
  to?: string
  page?: number
  /** 1–200. */
  page_size?: number
}

const loginResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_at: z.string(),
  user: authUserSchema,
})

export const PRODUCT_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED', 'UNLISTED'] as const
export const PRODUCT_SORTS = [
  'created_at',
  'updated_at',
  'title',
  'price',
  'inventory',
  'synced_at',
] as const

export const productStatusSchema = z.enum(PRODUCT_STATUSES)
export const productSortSchema = z.enum(PRODUCT_SORTS)

/** The store a product belongs to (what the UI shows next to products). */
const shopRefSchema = z.object({
  /** Short store key, e.g. "polymer-uk" — what the `shop=` parameter takes. */
  key: z.string().nullish(),
  name: z.string().nullish(),
  domain: z.string().nullish(),
  currency: z.string().nullish(),
})

const productListItemSchema = z.object({
  shop: shopRefSchema.nullish(),
  id: z.string(),
  shopify_id: z.number(),
  title: z.string(),
  handle: z.string(),
  status: z.string().nullable(),
  vendor: z.string().nullable(),
  product_type: z.string().nullable(),
  category_name: z.string().nullable(),
  tags: z.array(z.string()),
  image_url: z.string().nullable(),
  // Prices arrive as decimal strings (e.g. "170.00").
  price_min: z.string().nullable(),
  price_max: z.string().nullable(),
  currency: z.string().nullable(),
  variants_count: z.number(),
  total_inventory: z.number().nullable(),
  shopify_created_at: z.string().nullable(),
  shopify_updated_at: z.string().nullable(),
  synced_at: z.string(),
})

const productListResponseSchema = z.object({
  items: z.array(productListItemSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  total_pages: z.number(),
  has_next: z.boolean(),
  sort: z.string(),
  order: z.string(),
})

// --- Customers (GET /customers) ------------------------------------------------

export const CUSTOMER_ROLES = ['administrator', 'subscriber'] as const
export const CUSTOMER_STATES = ['ENABLED', 'DISABLED', 'INVITED', 'DECLINED'] as const
/** shopify = migrated from the store, crm = created here. */
export const CUSTOMER_SOURCES = ['shopify', 'crm'] as const
export const CUSTOMER_SORTS = [
  'created_at',
  'updated_at',
  'name',
  'email',
  'orders_count',
  'total_spent',
  'last_login',
] as const

const customerListItemSchema = z.object({
  /** The store the customer belongs to. */
  shop: shopRefSchema.nullish(),
  id: z.string(),
  // null for customers created in the CRM rather than migrated from Shopify.
  shopify_id: z.number().nullish(),
  email: z.string().nullish(),
  full_name: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  phone: z.string().nullish(),
  role: z.string(),
  is_active: z.boolean(),
  shopify_state: z.string().nullish(),
  accepts_marketing: z.boolean().nullish(),
  orders_count: z.number(),
  // A decimal string, e.g. "45.70".
  total_spent: z.string().nullish(),
  currency: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  // The merchant's note about the customer. The list does not return it yet (only the
  // details do); the Note column fills in as soon as the backend adds it here.
  note: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  last_order_name: z.string().nullish(),
  shopify_created_at: z.string().nullish(),
  last_login_at: z.string().nullish(),
})

const customerListResponseSchema = z.object({
  items: z.array(customerListItemSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  total_pages: z.number(),
  has_next: z.boolean(),
  sort: z.string(),
  order: z.string(),
})

export type CustomerRole = (typeof CUSTOMER_ROLES)[number]
export type CustomerState = (typeof CUSTOMER_STATES)[number]
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number]
export type CustomerSort = (typeof CUSTOMER_SORTS)[number]
export type CustomerListItem = z.infer<typeof customerListItemSchema>
export type CustomerListResponse = z.infer<typeof customerListResponseSchema>

/** Query parameters accepted by `GET /customers` (all optional). */
export interface CustomerListParams {
  /** Matches name, email, phone, tags or company (≤ 200 characters). */
  search?: string
  /**
   * The API's default is 'subscriber', so every row needs 'all' to be included — a
   * list that leaves this out silently hides administrators.
   */
  role?: CustomerRole | 'all'
  /** In the API, but the page deliberately has no Source filter. */
  source?: CustomerSource
  state?: CustomerState
  /** Store key or domain; omit for every store. */
  shop?: string
  accepts_marketing?: boolean
  has_orders?: boolean
  tag?: string
  country?: string
  min_spent?: number
  max_spent?: number
  sort?: CustomerSort
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

// --- Customer details (GET /customers/{ref}) ---------------------------------
// Optional-ish fields use `.nullish()` so one missing value in the backend's
// payload can't take the whole page down.

const customerAddressSchema = z.object({
  id: z.string(),
  shopify_id: z.number().nullish(),
  is_default: z.boolean().nullish(),
  position: z.number().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  name: z.string().nullish(),
  company: z.string().nullish(),
  address1: z.string().nullish(),
  address2: z.string().nullish(),
  city: z.string().nullish(),
  province: z.string().nullish(),
  province_code: z.string().nullish(),
  country: z.string().nullish(),
  country_code: z.string().nullish(),
  zip: z.string().nullish(),
  phone: z.string().nullish(),
  time_zone: z.string().nullish(),
})

const customerDetailSchema = z.object({
  shop: shopRefSchema.nullish(),
  id: z.string(),
  shopify_id: z.number().nullish(),
  shopify_gid: z.string().nullish(),
  email: z.string().nullish(),
  full_name: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  phone: z.string().nullish(),
  role: z.string(),
  is_active: z.boolean(),
  shopify_state: z.string().nullish(),
  verified_email: z.boolean().nullish(),
  accepts_marketing: z.boolean().nullish(),
  email_marketing_state: z.string().nullish(),
  email_marketing_opt_in_level: z.string().nullish(),
  email_marketing_updated_at: z.string().nullish(),
  sms_marketing_state: z.string().nullish(),
  sms_marketing_opt_in_level: z.string().nullish(),
  sms_marketing_updated_at: z.string().nullish(),
  tax_exempt: z.boolean().nullish(),
  tax_exemptions: z.array(z.string()).default([]),
  tax_id: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  note: z.string().nullish(),
  locale: z.string().nullish(),
  orders_count: z.number(),
  total_spent: z.string().nullish(),
  currency: z.string().nullish(),
  last_order_name: z.string().nullish(),
  rfm_group: z.string().nullish(),
  predicted_spend_tier: z.string().nullish(),
  data_sale_opt_out: z.boolean().nullish(),
  image_url: z.string().nullish(),
  shopify_created_at: z.string().nullish(),
  shopify_updated_at: z.string().nullish(),
  shopify_synced_at: z.string().nullish(),
  email_verified_at: z.string().nullish(),
  last_login_at: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  addresses: z.array(customerAddressSchema).default([]),
  metafields: z
    .array(
      z.object({
        namespace: z.string(),
        key: z.string(),
        value: z.string().nullish(),
        type: z.string().nullish(),
      }),
    )
    .default([]),
  /** The untouched Shopify payload — only present when requested. */
  raw_json: z.record(z.string(), z.unknown()).nullish(),
})

const customerDetailResponseSchema = z.object({ customer: customerDetailSchema })

/** What deleting a customer answers (the spec doesn't say; only a message is used, if there is one). */
const customerDeleteAnswerSchema = z.object({ message: z.string().nullish() })

export type CustomerDetail = z.infer<typeof customerDetailSchema>
export type CustomerAddress = z.infer<typeof customerAddressSchema>

// --- Product details (GET /products/{ref}) --------------------------------
// Optional-ish fields use `.nullish()` so one missing value in the backend's
// payload can't take the whole page down.

const priceRangeSchema = z.object({
  min: z.string().nullish(),
  max: z.string().nullish(),
  currency: z.string().nullish(),
})

const inventoryLevelSchema = z.object({
  location_shopify_id: z.number(),
  location_name: z.string().nullish(),
  available: z.number().nullish(),
  on_hand: z.number().nullish(),
  committed: z.number().nullish(),
  incoming: z.number().nullish(),
  shopify_updated_at: z.string().nullish(),
})

const metafieldSchema = z.object({
  namespace: z.string(),
  key: z.string(),
  value: z.string().nullish(),
  type: z.string().nullish(),
})

const productVariantSchema = z.object({
  id: z.string(),
  shopify_id: z.number(),
  title: z.string().nullish(),
  display_name: z.string().nullish(),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  position: z.number().nullish(),
  price: z.string(),
  compare_at_price: z.string().nullish(),
  cost: z.string().nullish(),
  currency: z.string().nullish(),
  taxable: z.boolean().nullish(),
  weight: z.string().nullish(),
  weight_unit: z.string().nullish(),
  requires_shipping: z.boolean().nullish(),
  inventory_policy: z.string().nullish(),
  inventory_management: z.string().nullish(),
  inventory_quantity: z.number().nullish(),
  available_for_sale: z.boolean().nullish(),
  image_url: z.string().nullish(),
  selected_options: z.array(z.object({ name: z.string(), value: z.string() })).nullish(),
  inventory_levels: z.array(inventoryLevelSchema).default([]),
  metafields: z.array(metafieldSchema).default([]),
})

const productImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt_text: z.string().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  position: z.number().nullish(),
  media_type: z.string().nullish(),
})

const productDetailSchema = z.object({
  shop: shopRefSchema.nullish(),
  id: z.string(),
  shopify_id: z.number(),
  title: z.string(),
  handle: z.string(),
  description_html: z.string().nullish(),
  status: z.string().nullish(),
  vendor: z.string().nullish(),
  product_type: z.string().nullish(),
  category: z
    .object({
      id: z.string().nullish(),
      name: z.string().nullish(),
      full_path: z.string().nullish(),
    })
    .nullish(),
  tags: z.array(z.string()).default([]),
  template_suffix: z.string().nullish(),
  has_only_default_variant: z.boolean().nullish(),
  has_out_of_stock_variants: z.boolean().nullish(),
  total_inventory: z.number().nullish(),
  tracks_inventory: z.boolean().nullish(),
  requires_selling_plan: z.boolean().nullish(),
  gift_card: z.boolean().nullish(),
  seo: z
    .object({ title: z.string().nullish(), description: z.string().nullish() })
    .nullish(),
  online_store_url: z.string().nullish(),
  online_store_preview_url: z.string().nullish(),
  currency: z.string().nullish(),
  price_range: priceRangeSchema.nullish(),
  compare_at_price_range: priceRangeSchema.nullish(),
  featured_image_url: z.string().nullish(),
  variants_count: z.number().nullish(),
  media_count: z.number().nullish(),
  published_at: z.string().nullish(),
  shopify_created_at: z.string().nullish(),
  shopify_updated_at: z.string().nullish(),
  synced_at: z.string(),
  options: z
    .array(
      z.object({ name: z.string(), position: z.number(), values: z.array(z.string()) }),
    )
    .default([]),
  images: z.array(productImageSchema).default([]),
  variants: z.array(productVariantSchema).default([]),
  collections: z
    .array(
      z.object({
        id: z.string(),
        shopify_id: z.number(),
        title: z.string(),
        handle: z.string(),
        collection_type: z.string().nullish(),
      }),
    )
    .default([]),
  metafields: z.array(metafieldSchema).default([]),
  /** The untouched Shopify payload — only present when requested. */
  raw_json: z.record(z.string(), z.unknown()).nullish(),
})

const productDetailResponseSchema = z.object({ product: productDetailSchema })

// --- Product edits (PUT /products/{id}, POST …/push, GET …/sync) ---------------
// An edit is saved in the CRM at once and pushed to the product's store right
// after the response; these describe the answer and the push's progress.

/** The answer to an edit (or a retried push). */
const productWriteResultSchema = z.object({
  product_id: z.string(),
  /** How the push to the store is going, e.g. "pending". */
  sync_status: z.string(),
  push_id: z.string().nullish(),
  /** What the backend recorded as changed. */
  changes: z.record(z.string(), z.unknown()).nullish(),
  message: z.string().default(''),
})

/**
 * What an edit, a retried push or a delete answers with: the fields above
 * inside the backend's usual envelope — `{ code, status, message, result: {…} }`
 * — or, accepted as well, the fields on their own. The envelope's `result` is
 * the one that counts (its `message` says what happened to the product).
 */
const productWriteResponseSchema = z.union([
  productWriteResultSchema,
  z.object({ result: productWriteResultSchema }).transform((body) => body.result),
])

// --- Creating a product (POST /products) ---------------------------------------

/** One variant of a new product. `price` is the only required field. */
export interface ProductCreateVariantInput {
  /** One value per option, in option order — leave out for a product without options. */
  option_values?: string[]
  price: string
  compare_at_price?: string
  sku?: string
  barcode?: string
  taxable?: boolean
  tax_code?: string
  inventory_policy?: InventoryPolicy
  /** Track stock in Shopify. */
  tracked?: boolean
  requires_shipping?: boolean
  cost?: string
  weight?: string
  weight_unit?: WeightUnit
  /** Opening stock per Shopify location. */
  stock?: { location_id: number; available: number }[]
  /** Must also be listed in `media`; shown for this variant (max 2000 characters). */
  image_url?: string
}

/** Body of `POST /products`: a store, a title and at least one variant with a price are required. */
export interface ProductCreateBody {
  /** Store key, e.g. "polymer-uk". */
  shop: string
  title: string
  description_html?: string
  vendor?: string
  product_type?: string
  /** New products start as DRAFT unless this says otherwise. */
  status?: ProductEditStatus
  /** Blank = Shopify makes one from the title. */
  handle?: string
  tags?: string[]
  seo?: { title?: string; description?: string }
  template_suffix?: string
  /** gid://shopify/TaxonomyCategory/… */
  category_gid?: string
  gift_card?: boolean
  /** Up to 3 (Size, Colour…). */
  options?: { name: string; values: string[] }[]
  /** 1–100. */
  variants: ProductCreateVariantInput[]
  /** Public https URLs, the first is featured (up to 50). */
  media?: ProductMediaInput[]
  /** CRM collection ids (manual collections only). */
  collections?: string[]
  metafields?: { namespace: string; key: string; type: string; value: string }[]
}

/** What creating a product answers with (the product is already in the CRM). */
const productCreateResultSchema = z.object({
  product_id: z.string(),
  shopify_id: z.number().nullish(),
  shopify_gid: z.string().nullish(),
  handle: z.string().default(''),
  title: z.string().default(''),
  status: z.string().default(''),
  shop: z.string().nullish(),
  variants: z.number().default(0),
  media: z.number().default(0),
  message: z.string().default(''),
})

/**
 * What `POST /products` really answers is `{ code: 201, status: "Created", message,
 * product: { product_id, shopify_id, … } }` — the fields sit under `product`. The
 * other wrappers this API uses (`result`) and the bare fields are accepted too, so
 * a product that was created is never reported as a failure over a key name.
 */
const productCreateResponseSchema = z.union([
  productCreateResultSchema,
  z.object({ product: productCreateResultSchema }).transform((body) => body.product),
  z.object({ result: productCreateResultSchema }).transform((body) => body.result),
])

export type ProductCreateResult = z.infer<typeof productCreateResultSchema>

/** A Shopify location a store keeps stock at (named by the stock list). */
const stockLocationSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  variants: z.number().default(0),
})

const stockLocationsResponseSchema = z.object({
  locations: z.array(stockLocationSchema).default([]),
})

export type StockLocation = z.infer<typeof stockLocationSchema>

/** One run of a sync (what `GET /sync/status` lists, newest first). */
const syncRunSchema = z.object({
  id: z.string(),
  entity: z.string().default(''),
  mode: z.string().default(''),
  /** Free text, e.g. "running", "completed", "failed". */
  status: z.string(),
  started_at: z.string(),
  finished_at: z.string().nullish(),
  /** Processed so far. */
  records_read: z.number().default(0),
  /** Saved so far. */
  records_written: z.number().default(0),
  error: z.string().nullish(),
})

/** The runs arrive as a bare list, or inside an envelope's `items`. */
const syncRunListSchema = z.union([
  z.array(syncRunSchema),
  z.object({ items: z.array(syncRunSchema) }).transform((body) => body.items),
])

export type SyncRun = z.infer<typeof syncRunSchema>

/** One push of this product to its store. */
const productPushSchema = z.object({
  id: z.string(),
  /** What was pushed (a product) and its id. */
  entity: z.string().nullish(),
  entity_id: z.string().nullish(),
  action: z.string().default(''),
  status: z.string(),
  attempts: z.number().default(0),
  error: z.string().nullish(),
  created_at: z.string(),
  /** The fields this push carried. */
  changes: z.record(z.string(), z.unknown()).nullish(),
  finished_at: z.string().nullish(),
})

/** The history arrives as a bare list, or inside an envelope's `items` ({ code, status, message, items }). */
const productPushListSchema = z.union([
  z.array(productPushSchema),
  z.object({ items: z.array(productPushSchema) }).transform((body) => body.items),
])

export type ProductWriteResult = z.infer<typeof productWriteResultSchema>
export type ProductPush = z.infer<typeof productPushSchema>

/** Statuses the API accepts for an edit (a product can't be edited *to* "unlisted"). */
export const PRODUCT_EDIT_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'] as const
export const INVENTORY_POLICIES = ['DENY', 'CONTINUE'] as const
export const WEIGHT_UNITS = ['GRAMS', 'KILOGRAMS', 'OUNCES', 'POUNDS'] as const
export const MEDIA_TYPES = ['IMAGE', 'VIDEO', 'EXTERNAL_VIDEO', 'MODEL_3D'] as const

export type ProductEditStatus = (typeof PRODUCT_EDIT_STATUSES)[number]
export type InventoryPolicy = (typeof INVENTORY_POLICIES)[number]
export type WeightUnit = (typeof WEIGHT_UNITS)[number]
export type MediaType = (typeof MEDIA_TYPES)[number]

/** Update an existing variant (give `id`) or create one (no id, give `option_values`). */
export interface ProductVariantInput {
  /** CRM variant id to update; omit to create a new variant. */
  id?: string
  /** New variant only: one value per product option, in option order. */
  option_values?: string[]
  /** A number or decimal string, ≥ 0. */
  price?: string | number
  compare_at_price?: string | number | null
  sku?: string
  barcode?: string
  taxable?: boolean
  tax_code?: string
  inventory_policy?: InventoryPolicy
  /** Track stock in Shopify. */
  tracked?: boolean
  requires_shipping?: boolean
  cost?: string | number | null
  weight?: string | number | null
  weight_unit?: WeightUnit
  /** Product image (CRM attachment id) to show for this variant. */
  image_attachment_id?: string | null
  /** Variant metafields to set / delete. */
  metafields?: ProductMetafieldInput[]
  metafields_remove?: ProductMetafieldRemoval[]
}

/** A metafield to set (created, or its value replaced). `type` is Shopify's, e.g. `json_string`. */
export interface ProductMetafieldInput {
  namespace: string
  key: string
  type: string
  value: string
}

/** A metafield to delete. */
export interface ProductMetafieldRemoval {
  namespace: string
  key: string
}

/** A picture or video to attach, by public https URL. */
export interface ProductMediaInput {
  url: string
  alt?: string
  media_type?: MediaType
}

/**
 * Body of `PUT /products/{id}`: any subset of fields — anything left out is
 * unchanged. List fields named `…_add` / `…_remove` change a list without
 * replacing it.
 */
export interface ProductUpdateBody {
  title?: string
  description_html?: string
  vendor?: string
  product_type?: string
  status?: ProductEditStatus
  handle?: string
  /** Replace the whole tag list. */
  tags?: string[]
  tags_add?: string[]
  tags_remove?: string[]
  seo?: { title?: string; description?: string }
  template_suffix?: string
  /** Shopify taxonomy id, gid://shopify/TaxonomyCategory/… */
  category_gid?: string
  /** CRM collection ids. */
  collections_add?: string[]
  collections_remove?: string[]
  /** New product options (Size → Small, Large). */
  options_add?: { name: string; values: string[] }[]
  variants?: ProductVariantInput[]
  /** CRM variant ids to delete in Shopify. */
  variants_remove?: string[]
  /** Product metafields to set (created, or the value replaced) / delete. */
  metafields?: ProductMetafieldInput[]
  metafields_remove?: ProductMetafieldRemoval[]
  media_add?: ProductMediaInput[]
  /** Change the alt text of existing images. */
  media_update?: { attachment_id: string; alt: string }[]
  /** CRM attachment ids. */
  media_remove?: string[]
  /** Attachment ids in the wanted order (first = featured). */
  media_order?: string[]
}

export type ProductDetail = z.infer<typeof productDetailSchema>
export type ProductVariant = z.infer<typeof productVariantSchema>
export type ProductImage = z.infer<typeof productImageSchema>

export type ProductStatus = z.infer<typeof productStatusSchema>
export type ProductSort = z.infer<typeof productSortSchema>
export type ProductListItem = z.infer<typeof productListItemSchema>
export type ProductListResponse = z.infer<typeof productListResponseSchema>

/** Query parameters accepted by `GET /products` (all optional). */
export interface ProductListParams {
  search?: string
  status?: ProductStatus
  /** Store key or domain; omit for every store. */
  shop?: string
  product_type?: string
  tag?: string
  min_price?: number
  max_price?: number
  in_stock?: boolean
  sort?: ProductSort
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export type Shop = z.infer<typeof shopSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>
export type LoginResponse = z.infer<typeof loginResponseSchema>

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const api = {
  customers: {
    /** One page of customers, filtered/sorted server-side. Needs a signed-in session. */
    async list(params: CustomerListParams): Promise<CustomerListResponse> {
      const data = await apiClient.get(ENDPOINTS.customers.list, { params })
      return customerListResponseSchema.parse(data)
    },

    /**
     * Everything about one customer. `includeRaw` also returns Shopify's
     * original payload (large) — leave it off unless it's going to be shown.
     */
    /**
     * Deletes a customer in the store AND the CRM — permanent. Shopify only allows it
     * for a customer without orders (the backend then answers with its reason).
     * `ref` is the customer's UUID, Shopify id or email; `shop` the store key. Never
     * retried automatically.
     */
    async remove(ref: string, shop?: string | null): Promise<{ message: string }> {
      const data = await apiClient.delete(ENDPOINTS.customers.detail(ref), {
        params: shop ? { shop } : undefined,
      })
      const parsed = customerDeleteAnswerSchema.safeParse(data)
      return { message: parsed.success ? (parsed.data.message ?? '') : '' }
    },

    async details(ref: string, includeRaw = false): Promise<CustomerDetail> {
      const data = await apiClient.get(ENDPOINTS.customers.detail(ref), {
        params: { include_raw: includeRaw },
      })
      return customerDetailResponseSchema.parse(data).customer
    },
  },

  inventory: {
    /**
     * The Shopify locations a store keeps stock at — read from the stock list
     * (one row is enough; only its `locations` are used).
     */
    async locations(shop?: string | null): Promise<StockLocation[]> {
      const data = await apiClient.get(ENDPOINTS.inventory.list, {
        params: { page_size: 1, ...(shop ? { shop } : {}) },
      })
      return stockLocationsResponseSchema.parse(data).locations
    },
  },

  sync: {
    /**
     * Starts a sync of every product of a store (`shop` = its key; empty means
     * the backend's default store). It runs in the background — follow it with
     * `status`. Only success matters here, so the answer is read leniently:
     * the backend's message when it sent one. Never retried automatically.
     */
    async triggerProducts(shop?: string | null): Promise<{ message: string }> {
      const data = await apiClient.post<unknown>(ENDPOINTS.sync.products, undefined, {
        params: shop ? { shop } : undefined,
      })
      const message =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message: unknown }).message ?? '')
          : ''
      return { message }
    },

    /** The most recent sync runs, newest first. */
    async status(options: {
      entity?: string
      limit?: number
      shop?: string | null
    }): Promise<SyncRun[]> {
      const { entity, limit = 10, shop } = options
      const data = await apiClient.get(ENDPOINTS.sync.status, {
        params: { limit, ...(entity ? { entity } : {}), ...(shop ? { shop } : {}) },
      })
      return syncRunListSchema.parse(data)
    },
  },

  products: {
    /** One page of products, filtered/sorted server-side. Needs a signed-in session. */
    async list(params: ProductListParams): Promise<ProductListResponse> {
      const data = await apiClient.get(ENDPOINTS.products.list, { params })
      return productListResponseSchema.parse(data)
    },

    /**
     * Everything about one product. `includeRaw` also returns Shopify's
     * original payload (large) — leave it off unless it's going to be shown.
     */
    async details(ref: string, includeRaw = false): Promise<ProductDetail> {
      const data = await apiClient.get(ENDPOINTS.products.detail(ref), {
        params: { include_raw: includeRaw },
      })
      return productDetailResponseSchema.parse(data).product
    },

    /**
     * Edits a product (any subset of fields). The change is saved in the CRM
     * at once; the push to the store follows right after the response — see
     * `syncHistory` for how it went. `shop` is the product's store key.
     */
    async update(
      id: string,
      body: ProductUpdateBody,
      shop?: string | null,
    ): Promise<ProductWriteResult> {
      const data = await apiClient.put(ENDPOINTS.products.update(id), body, {
        params: shop ? { shop } : undefined,
      })
      return productWriteResponseSchema.parse(data)
    },

    /**
     * Deletes a product with the backend's default behaviour (`mode` is left out,
     * so the backend decides — it archives, which can be undone). The answer is
     * the same as for an edit, and the change is pushed to the store right after.
     * Never retried automatically. `shop` is the product's store key.
     */
    async remove(id: string, shop?: string | null): Promise<ProductWriteResult> {
      const data = await apiClient.delete(ENDPOINTS.products.remove(id), {
        params: shop ? { shop } : undefined,
      })
      return productWriteResponseSchema.parse(data)
    },

    /**
     * Creates a product with its options, variants, prices, opening stock, media,
     * collections and metafields. Shopify is the system of record for ids, so it
     * is created there first (1–3 seconds) and then read back into the CRM; the
     * answer carries the new product's id. Never retried automatically — a repeat
     * could create the product twice.
     */
    async create(body: ProductCreateBody): Promise<ProductCreateResult> {
      const data = await apiClient.post(ENDPOINTS.products.create, body)
      return productCreateResponseSchema.parse(data)
    },

    /**
     * Attaches images/videos to a product by public https URL (1–20 per call).
     * Shopify downloads each file to its CDN and the CRM stores only the CDN URL
     * it gets back, so the new attachments appear a little later; the answer says
     * "Media queued for Shopify". Never retried automatically.
     */
    async addMedia(
      id: string,
      items: ProductMediaInput[],
      shop?: string | null,
    ): Promise<ProductWriteResult> {
      const data = await apiClient.post(
        ENDPOINTS.products.media(id),
        { items },
        { params: shop ? { shop } : undefined },
      )
      return productWriteResponseSchema.parse(data)
    },

    /** Removes one media attachment from a product ("Media removal queued"). Never retried automatically. */
    async removeMedia(
      id: string,
      attachmentId: string,
      shop?: string | null,
    ): Promise<ProductWriteResult> {
      const data = await apiClient.delete(
        ENDPOINTS.products.mediaItem(id, attachmentId),
        {
          params: shop ? { shop } : undefined,
        },
      )
      return productWriteResponseSchema.parse(data)
    },

    /** Retries the latest failed or pending push of a product to its store. */
    async push(id: string, shop?: string | null): Promise<ProductWriteResult> {
      const data = await apiClient.post(ENDPOINTS.products.push(id), undefined, {
        params: shop ? { shop } : undefined,
      })
      return productWriteResponseSchema.parse(data)
    },

    /** The product's recent pushes to its store, newest first. */
    async syncHistory(
      id: string,
      shop?: string | null,
      limit = 20,
    ): Promise<ProductPush[]> {
      const data = await apiClient.get(ENDPOINTS.products.sync(id), {
        params: { limit, ...(shop ? { shop } : {}) },
      })
      return productPushListSchema.parse(data)
    },
  },

  shops: {
    /** Stores the signed-in user may see, in dropdown order (admins see all). */
    async list(): Promise<Shop[]> {
      const data = await apiClient.get(ENDPOINTS.shops.list)
      return shopListResponseSchema.parse(data).items
    },
  },

  users: {
    /** One page of CRM users, filtered server-side. Needs a signed-in session. */
    async list(params: UserListParams): Promise<UserListResponse> {
      const data = await apiClient.get(ENDPOINTS.users.list, { params })
      return userListResponseSchema.parse(data)
    },

    /** Creates a staff user (they sign in by emailed code or Google). Returns the new user. */
    async create(body: UserCreateBody): Promise<UserItem> {
      const data = await apiClient.post(ENDPOINTS.users.create, body)
      return userCreateResponseSchema.parse(data).user
    },
  },

  roles: {
    /** Every role the backend knows (the create form and the role filter use their names). */
    async list(): Promise<Role[]> {
      const data = await apiClient.get(ENDPOINTS.roles.list)
      return roleListResponseSchema.parse(data).items
    },
  },

  activity: {
    /** One page of the activity log, newest first, filtered server-side. */
    async list(params: ActivityListParams): Promise<ActivityListResponse> {
      const data = await apiClient.get(ENDPOINTS.activity.list, { params })
      return activityListResponseSchema.parse(data)
    },

    /** Every action name that appears in the log, with how often (for the filter dropdown). */
    async actions(): Promise<ActivityActionCount[]> {
      const data = await apiClient.get(ENDPOINTS.activity.actions)
      return activityActionsResponseSchema.parse(data).items
    },
  },

  auth: {
    /** Step 1 of login: emails a 6-digit code (valid 10 minutes). */
    async requestOtp(email: string): Promise<OtpRequestResponse> {
      const data = await apiClient.post(ENDPOINTS.auth.requestOtp, { email })
      return otpRequestResponseSchema.parse(data)
    },

    /** Step 2 of login: exchanges the code for an access token (30 days, see `STAY_SIGNED_IN`). */
    async verifyOtp(email: string, code: string): Promise<LoginResponse> {
      const data = await apiClient.post(ENDPOINTS.auth.verifyOtp, {
        email,
        code,
        remember_me: STAY_SIGNED_IN,
      })
      return loginResponseSchema.parse(data)
    },

    /**
     * Google sign-in: exchanges a Google ID token (the `credential` from
     * Google Identity Services) for an access token. Only emails that
     * already belong to an active CRM user can sign in.
     */
    async google(credential: string): Promise<LoginResponse> {
      const data = await apiClient.post(ENDPOINTS.auth.google, {
        credential,
        remember_me: STAY_SIGNED_IN,
      })
      return loginResponseSchema.parse(data)
    },

    /**
     * Invalidates the token server-side. The token is passed explicitly
     * because callers clear the local session first (so the UI responds
     * instantly), which also clears the client's default token.
     */
    async logout(accessToken: string): Promise<void> {
      await apiClient.post(ENDPOINTS.auth.logout, undefined, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    },
  },
}
