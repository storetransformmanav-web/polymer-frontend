import { z } from 'zod'
import { ApiError } from './ApiError.ts'
import { toNumber } from './invoices.ts'

/**
 * Sage 50 customers — `GET /api/sage/customers` (the list), `/export` (a CSV), `/{account_ref}` (one
 * customer in full), `/{account_ref}/transactions` (the sales ledger / statement) and
 * `/{account_ref}/contact-history`. The shapes are the backend's documented ones; every field is
 * read leniently (amounts arrive as text — "169.5" — and become numbers, a missing or null field
 * becomes empty) so one odd value never fails a whole page. **Nothing here is data**: names, figures,
 * statuses and labels all come from the answers.
 */

export const SAGE_CUSTOMER_TABS = [
  'all',
  'open',
  'on_hold',
  'with_balance',
  'over_limit',
  'inactive',
] as const
export type SageCustomerTab = (typeof SAGE_CUSTOMER_TABS)[number]

/** What the list can be sorted by (the API's own `sort` values). */
export const SAGE_CUSTOMER_SORTS = [
  'account_ref',
  'name',
  'balance',
  'credit_limit',
  'aged_over_30',
  'turnover_ytd',
  'last_invoice_date',
  'last_payment_date',
  'opened_on',
] as const
export type SageCustomerSort = (typeof SAGE_CUSTOMER_SORTS)[number]

export const SAGE_CUSTOMER_MAX_PAGE_SIZE = 100
export const SAGE_TRANSACTION_MAX_PAGE_SIZE = 200
export const SAGE_HISTORY_MAX_PAGE_SIZE = 100

/** The transaction types the statement can be narrowed to (the API's own `type` options). */
export const SAGE_TRANSACTION_TYPES = ['SI', 'SC', 'SR', 'SA', 'SD', 'SP'] as const

/** The query of `GET /api/sage/customers` (empty ones are left out). */
export type SageCustomerListParams = Partial<Record<string, string | number | boolean>>

/** The query of `GET /api/sage/customers/export`: the list's own, without paging. */
export type SageCustomerExportParams = Partial<Record<string, string | number | boolean>>

export type SageTransactionParams = Partial<Record<string, string | number | boolean>>

// ----------------------------------------------------------------------------------- building blocks

/** "169.5" or 169.5 → 169.5; anything else (or nothing) → null. */
const amount = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => toNumber(value))

const text = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) =>
    value === null || value === undefined ? '' : String(value).trim(),
  )

const flag = z
  .boolean()
  .nullish()
  .transform((value) => value === true)

/** A whole number; 0 when it isn't one. */
const whole = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => toNumber(value) ?? 0)

const date = text.transform((value) => value || null)

const crmCustomerSchema = z
  .object({
    id: text,
    name: text,
    email: text,
    orders_count: whole,
    total_spent: amount,
    matched_by: text,
  })
  .nullish()
  .transform((value) => (value && value.id ? value : null))

export type SageCrmCustomer = NonNullable<z.output<typeof crmCustomerSchema>>

const addressSchema = z
  .object({
    name: text,
    address_1: text,
    address_2: text,
    address_3: text,
    address_4: text,
    address_5: text,
    lines: z
      .array(z.string().nullish())
      .nullish()
      .transform((lines) =>
        (lines ?? []).map((line) => (line ?? '').trim()).filter(Boolean),
      ),
  })
  .nullish()
  .transform((value) => {
    if (!value) return null
    // The API's own formatted lines when it has them, else the numbered ones.
    const lines =
      value.lines.length > 0
        ? value.lines
        : [
            value.name,
            value.address_1,
            value.address_2,
            value.address_3,
            value.address_4,
            value.address_5,
          ].filter(Boolean)
    return lines.length > 0 ? { name: value.name, lines } : null
  })

export type SageAddress = NonNullable<z.output<typeof addressSchema>>

// ------------------------------------------------------------------------------------------- list

const listItemSchema = z.object({
  account_ref: text,
  name: text,
  contact_name: text,
  telephone: text,
  email: text,
  town: text,
  postcode: text,
  country_code: text,
  currency: text,
  balance: amount,
  credit_limit: amount,
  available_credit: amount,
  over_credit_limit: flag,
  aged_over_30: amount,
  on_hold: flag,
  inactive: flag,
  status: text,
  turnover_mtd: amount,
  turnover_ytd: amount,
  turnover_prior_year: amount,
  first_invoice_date: date,
  last_invoice_date: date,
  last_payment_date: date,
  opened_on: date,
  pricing_ref: text,
  crm_customer: crmCustomerSchema,
})

export type SageCustomer = z.output<typeof listItemSchema>

const listTotalsSchema = z
  .object({
    customers: z.number().nullish(),
    balance: amount,
    aged_over_30: amount,
    turnover_ytd: amount,
    credit_limit: amount,
  })
  .nullish()
  .transform((value) =>
    value
      ? {
          customers: value.customers ?? null,
          balance: value.balance,
          agedOver30: value.aged_over_30,
          turnoverYtd: value.turnover_ytd,
          creditLimit: value.credit_limit,
        }
      : null,
  )

export type SageCustomerTotals = NonNullable<z.output<typeof listTotalsSchema>>

const listResponseSchema = z
  .object({
    message: text,
    items: z.array(listItemSchema),
    totals: listTotalsSchema,
    tab_counts: z.record(z.string(), z.number()).nullish(),
    page: z.number().nullish(),
    page_size: z.number().nullish(),
    total: z.number().nullish(),
    total_pages: z.number().nullish(),
    has_next: z.boolean().nullish(),
    data_as_of: text,
  })
  .transform((data) => {
    const pageSize = data.page_size ?? (data.items.length || 25)
    const total = data.total ?? data.totals?.customers ?? data.items.length
    return {
      message: data.message,
      items: data.items,
      totals: data.totals,
      tabCounts: data.tab_counts ?? {},
      page: data.page ?? 1,
      pageSize,
      total,
      totalPages:
        data.total_pages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
      hasNext: data.has_next ?? false,
      dataAsOf: data.data_as_of || null,
    }
  })

export type SageCustomerListResponse = z.output<typeof listResponseSchema>

// --------------------------------------------------------------------------------------- one customer

const transactionSchema = z.object({
  transaction_number: text,
  type: text,
  type_label: text,
  date,
  reference: text,
  details: text,
  due_date: date,
  net: amount,
  tax: amount,
  gross: amount,
  paid: amount,
  outstanding: amount,
  payment_status: text,
  overdue: flag,
  disputed: flag,
  entered_by: text,
})

export type SageTransaction = z.output<typeof transactionSchema>

const contactEntrySchema = z.object({
  id: text,
  date,
  major_type: text,
  type: text,
  outcome: text,
  subject: text,
  notes: text,
  contact: text,
  telephone: text,
  user: text,
  start_time: text,
  end_time: text,
  duration: text,
  promised_payment: amount,
  promised_payment_date: date,
  follow_up_date: date,
})

export type SageContactEntry = z.output<typeof contactEntrySchema>

const detailAddressSchema = z.object({
  kind: text,
  kind_label: text,
  reference: text,
  description: text,
  address: addressSchema,
  contact_name: text,
  telephone: text,
  telephone_2: text,
  email: text,
  tax_code: text,
  country_code: text,
  vat_reg_number: text,
  notes: text,
})

export type SageAddressEntry = z.output<typeof detailAddressSchema>

const customerDetailSchema = z.object({
  account_ref: text,
  name: text,
  status: text,
  on_hold: flag,
  inactive: flag,
  opened_on: date,
  shopify_customer_id: text,
  crm_customer: crmCustomerSchema,
  contact: z
    .object({
      contact_name: text,
      trade_contact: text,
      telephone: text,
      telephone_2: text,
      fax: text,
      emails: z
        .array(z.string().nullish())
        .nullish()
        .transform((list) =>
          (list ?? []).map((item) => (item ?? '').trim()).filter(Boolean),
        ),
      direct_debits_email: text,
      web_address: text,
      letters_via_email: z.boolean().nullish(),
    })
    .nullish(),
  company: z
    .object({
      vat_reg_number: text,
      company_registration_number: text,
      eori_number: text,
      duns_number: text,
      department: text,
      country_code: text,
      currency: text,
    })
    .nullish(),
  invoice_address: addressSchema,
  default_delivery_address: addressSchema,
  addresses: z.array(detailAddressSchema).nullish(),
  credit: z
    .object({
      balance: amount,
      credit_limit: amount,
      available_credit: amount,
      over_credit_limit: flag,
      on_hold: flag,
      payment_due_days: z.number().nullish(),
      payment_due_from: text,
      settlement_discount_rate: text,
      settlement_due_days: z.number().nullish(),
      discount_rate: text,
      pricing_ref: text,
      price_list_name: text,
      default_tax_code: text,
      average_pay_days: z.number().nullish(),
      credit_reference: text,
      priority: text,
      promised_payment: text,
      promised_payment_date: date,
      terms_agreed: z.boolean().nullish(),
      can_charge_interest: z.boolean().nullish(),
      restrict_mail: z.boolean().nullish(),
    })
    .nullish(),
  aged_debt: z
    .object({
      future: amount,
      current: amount,
      days_30: amount,
      days_60: amount,
      days_90: amount,
      older: amount,
      total: amount,
      over_30: amount,
    })
    .nullish(),
  open_items: z.array(transactionSchema).nullish(),
  activity: z
    .object({
      first_invoice_date: date,
      last_invoice_date: date,
      last_payment_date: date,
      turnover_mtd: amount,
      turnover_ytd: amount,
      turnover_prior_year: amount,
      financial_year_start: date,
      months: z
        .array(
          z.object({
            month: text,
            period: z.number().nullish(),
            invoices: amount,
            credits: amount,
            payments: amount,
          }),
        )
        .nullish(),
    })
    .nullish(),
  analysis: z.array(z.object({ number: z.number().nullish(), value: text })).nullish(),
  counts: z
    .object({
      invoices: whole,
      sales_orders: whole,
      open_sales_orders: whole,
      transactions: whole,
      open_transactions: whole,
      contact_history: whole,
    })
    .nullish(),
  recent_invoices: z
    .array(
      z.object({
        invoice_number: text,
        kind: text,
        invoice_date: date,
        customer_order_number: text,
        order_number: text,
        gross: amount,
        outstanding: amount,
        payment_status: text,
      }),
    )
    .nullish(),
  contact_history: z.array(contactEntrySchema).nullish(),
  recent_orders: z
    .array(
      z.object({
        order_number: text,
        order_date: date,
        status: text,
        customer_order_number: text,
        invoice_number: text,
        gross: amount,
        despatch_date: date,
      }),
    )
    .nullish(),
  data_as_of: text,
})

const detailResponseSchema = z.object({ customer: customerDetailSchema })

export type SageCustomerDetail = z.output<typeof customerDetailSchema>

// ------------------------------------------------------------------------- transactions / contact history

const pagingShape = {
  page: z.number().nullish(),
  page_size: z.number().nullish(),
  total: z.number().nullish(),
  total_pages: z.number().nullish(),
  has_next: z.boolean().nullish(),
}

function paging(
  data: {
    page?: number | null
    page_size?: number | null
    total?: number | null
    total_pages?: number | null
    has_next?: boolean | null
  },
  count: number,
) {
  const pageSize = data.page_size || count || 25
  const total = data.total ?? count
  return {
    page: data.page || 1,
    pageSize,
    total,
    totalPages: data.total_pages || Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
    hasNext: data.has_next ?? false,
  }
}

const transactionsResponseSchema = z
  .object({
    account_ref: text,
    name: text,
    balance: amount,
    items: z.array(transactionSchema),
    totals: z
      .object({
        transactions: z.number().nullish(),
        debits: amount,
        credits: amount,
        outstanding: amount,
      })
      .nullish(),
    ...pagingShape,
  })
  .transform((data) => ({
    accountRef: data.account_ref,
    name: data.name,
    balance: data.balance,
    items: data.items,
    totals: data.totals
      ? {
          transactions: data.totals.transactions ?? null,
          debits: data.totals.debits,
          credits: data.totals.credits,
          outstanding: data.totals.outstanding,
        }
      : null,
    ...paging(data, data.items.length),
  }))

export type SageTransactionsResponse = z.output<typeof transactionsResponseSchema>

const contactHistoryResponseSchema = z
  .object({
    account_ref: text,
    name: text,
    items: z.array(contactEntrySchema),
    ...pagingShape,
  })
  .transform((data) => ({
    accountRef: data.account_ref,
    name: data.name,
    items: data.items,
    ...paging(data, data.items.length),
  }))

export type SageContactHistoryResponse = z.output<typeof contactHistoryResponseSchema>

// ------------------------------------------------------------------------------------------- readers

/**
 * Checks an answer against its schema. One that doesn't fit fails with a message naming the part
 * ("…(items.0.balance: …)") instead of the generic fallback.
 */
function read<Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
  what: string,
): z.output<Schema> {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const where =
    issue && issue.path.length > 0 ? ` (${issue.path.join('.')}: ${issue.message})` : ''
  throw new ApiError(`The ${what} answer was not in the expected form${where}.`)
}

export const readSageCustomerList = (data: unknown) =>
  read(listResponseSchema, data, 'Sage customers')

export const readSageCustomerDetail = (data: unknown): SageCustomerDetail =>
  read(detailResponseSchema, data, 'Sage customer').customer

export const readSageTransactions = (data: unknown) =>
  read(transactionsResponseSchema, data, 'Sage transactions')

export const readSageContactHistory = (data: unknown) =>
  read(contactHistoryResponseSchema, data, 'Sage contact history')
