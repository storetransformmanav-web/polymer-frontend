import { ApiError } from './ApiError.ts'
import { canonicalKey, toNumber } from './invoices.ts'

/**
 * One Sage 50 invoice in full — `GET /api/sage/invoices/{invoice_number}`. The answer's field names
 * are **not published** (the API's documentation is not readable from here), so it is read
 * leniently: each value is looked for under the names the backend is likely to use, in the answer
 * itself and in the objects inside it (`customer`, `totals`, `payment`…), ignoring letter case and
 * `_` / `-`. Whatever the page does not recognise is kept in `moreFields`, so nothing the API sends
 * is lost, and a name that turns out to differ is one line in the lists below.
 */

type Raw = Record<string, unknown>

const isRaw = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

/** Looks up the first of `names` present in any of `scopes` (earlier scopes win). */
function lookup(
  scopes: readonly (Raw | null | undefined)[],
  names: readonly string[],
): unknown {
  for (const scope of scopes) {
    if (!scope) continue
    const index = new Map<string, unknown>()
    for (const [key, value] of Object.entries(scope)) index.set(norm(key), value)
    for (const name of names) {
      const value = index.get(norm(name))
      if (!isBlank(value)) return value
    }
  }
  return undefined
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/** A flag from true / false, 0 / 1 or "yes" / "no" text; null when it is none of them. */
export function toFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const word = value.trim().toLowerCase()
    if (['true', 'yes', 'y', '1'].includes(word)) return true
    if (['false', 'no', 'n', '0'].includes(word)) return false
  }
  return null
}

/** Every plain object directly inside `root`, so a value is found whether the answer is flat or grouped. */
const childrenOf = (root: Raw): Raw[] => Object.values(root).filter(isRaw)

export interface InvoiceAddress {
  /** The address as the API formats it (or put together from its fields): one line each. */
  lines: string[]
  /** Every plain field of the address, label and value, for the detail grid. */
  fields: [string, string][]
}

export interface InvoiceCrmProduct {
  id: string | null
  title: string
  handle: string
  status: string
  imageUrl: string | null
}

export interface InvoiceLine {
  position: string
  imageUrl: string | null
  stockCode: string
  description: string
  extraText: string
  unitOfSale: string
  quantity: number | null
  unitPrice: number | null
  discountRate: number | null
  discountAmount: number | null
  net: number | null
  taxCode: string
  taxRate: number | null
  tax: number | null
  gross: number | null
  nominalCode: string
  deliveryDate: string | null
  /** A line of text only (a heading or a note): no product, no amounts. */
  isTextLine: boolean
  crmProduct: InvoiceCrmProduct | null
}

export interface InvoiceVatRow {
  rate: string
  net: number | null
  tax: number | null
}

export interface InvoiceDetail {
  number: string
  kind: string
  kindLabel: string
  date: string | null
  createdAt: string | null
  currency: string | null
  /** Posted / Not Posted as the API says it (null when it says nothing). */
  posted: boolean | null
  postedText: string
  printed: string
  customerOrderNumber: string
  takenBy: string
  fromSalesOrder: string
  quoteStatus: string
  quoteExpiry: string | null
  customer: {
    name: string
    accountRef: string
    contactName: string
    telephone: string
    telephone2: string
    email: string
    vatNumber: string
    countryCode: string
    creditLimit: number | null
    balance: number | null
    onHold: boolean | null
    paymentDueDays: string
    crmCustomerId: string
  }
  invoiceAddress: InvoiceAddress | null
  deliveryAddress: InvoiceAddress | null
  lines: InvoiceLine[]
  summary: {
    itemsNet: number | null
    itemsTax: number | null
    discountNet: number | null
    discountDescription: string
    carriageNet: number | null
    carriageTax: number | null
    carriageGross: number | null
    totalNet: number | null
    totalTax: number | null
    totalGross: number | null
    prepaid: number | null
  }
  vat: InvoiceVatRow[]
  payment: {
    status: string
    paid: number | null
    outstanding: number | null
    dueDate: string | null
    overdue: boolean | null
    daysOverdue: number | null
    ledgerTransaction: string
  }
  /** Every payment allocation, each with all the fields the API sent. */
  payments: Raw[]
  additional: {
    notes: string
    courier: string
    consignment: string
    settlementDueDays: string
    settlementDiscountRate: string
  }
  /** The sales order's own fields, when the API sends one. */
  salesOrder: [string, string][] | null
  /** Plain fields the page has no place for, label and value. */
  moreFields: [string, string][]
}

// ---------------------------------------------------------------------------- names

const N = {
  number: ['invoice_number', 'number', 'invoice_no', 'document_number', 'doc_number'],
  kind: ['kind', 'document_type', 'doc_type', 'type'],
  kindLabel: ['kind_label', 'document_type_label', 'type_label', 'kind_name'],
  date: ['invoice_date', 'date', 'document_date', 'tax_date'],
  createdAt: ['created_at', 'created', 'created_on', 'entered_at', 'entered_date'],
  currency: ['currency', 'currency_code', 'currency_iso'],
  posted: ['posted', 'is_posted', 'posted_status', 'posting_status'],
  printed: ['printed', 'is_printed', 'printed_status', 'print_status'],
  customerOrder: [
    'customer_order_number',
    'customer_order_no',
    'cust_order_no',
    'customer_order',
  ],
  takenBy: ['taken_by', 'taken_by_name', 'created_by'],
  fromSalesOrder: [
    'from_sales_order',
    'sales_order_number',
    'sales_order_no',
    'sales_order_ref',
    'sop_number',
  ],
  quoteStatus: ['quote_status'],
  quoteExpiry: [
    'quote_expiry_date',
    'quote_expiry',
    'quote_expires_at',
    'quote_valid_until',
  ],
  custName: ['customer_name', 'name', 'account_name', 'company_name', 'company'],
  accountRef: [
    'account_ref',
    'account_reference',
    'customer_account_ref',
    'customer_ref',
    'account_number',
  ],
  contactName: ['contact_name', 'contact', 'contact_person'],
  telephone: ['telephone', 'telephone_1', 'phone', 'tel', 'telephone_number'],
  telephone2: [
    'telephone_2',
    'secondary_telephone',
    'phone_2',
    'second_telephone',
    'mobile',
  ],
  email: ['email', 'email_address'],
  vatNumber: [
    'vat_registration_number',
    'vat_number',
    'vat_reg_no',
    'vat_registration',
    'vat_reg',
  ],
  countryCode: ['country_code', 'country'],
  creditLimit: ['credit_limit'],
  balance: ['account_balance', 'balance'],
  onHold: ['on_hold', 'is_on_hold', 'account_on_hold', 'hold'],
  paymentDueDays: ['payment_due_days', 'payment_terms_days', 'terms_days', 'due_days'],
  crmCustomerId: ['crm_customer_id', 'crm_customer', 'customer_id', 'crm_id'],
  invoiceAddress: ['invoice_address', 'billing_address', 'bill_to', 'address'],
  deliveryAddress: ['delivery_address', 'shipping_address', 'ship_to', 'delivery'],
  lines: ['lines', 'line_items', 'items', 'products', 'invoice_lines', 'details'],
  itemsNet: ['items_net', 'goods_net', 'items_net_total'],
  itemsTax: ['items_tax', 'goods_tax', 'items_tax_total'],
  discountNet: ['discount_net', 'discount_net_total'],
  discountDescription: ['discount_description', 'discount_desc', 'discount_text'],
  carriageNet: ['carriage_net'],
  carriageTax: ['carriage_tax'],
  carriageGross: ['carriage_gross'],
  totalNet: ['total_net', 'net_total', 'net'],
  totalTax: ['total_tax', 'tax_total', 'tax'],
  totalGross: ['total_gross', 'gross_total', 'gross', 'total'],
  prepaid: ['amount_prepaid', 'prepaid', 'prepayment', 'prepaid_amount'],
  vat: [
    'vat_analysis',
    'vat_breakdown',
    'vat_summary',
    'tax_analysis',
    'tax_breakdown',
    'vat',
  ],
  payStatus: ['payment_status', 'paid_status', 'status'],
  paid: ['paid_amount', 'amount_paid', 'paid'],
  outstanding: ['outstanding_amount', 'amount_outstanding', 'outstanding', 'balance_due'],
  dueDate: ['due_date', 'payment_due_date', 'date_due'],
  overdue: ['overdue', 'is_overdue', 'overdue_status'],
  daysOverdue: ['days_overdue', 'overdue_days'],
  ledger: [
    'ledger_transaction',
    'ledger_transaction_no',
    'ledger_trans',
    'ledger_transaction_number',
  ],
  payments: ['payments', 'payment_allocations', 'allocations', 'receipts'],
  notes: ['notes', 'invoice_notes', 'note', 'comments'],
  courier: ['courier', 'carrier', 'delivery_method'],
  consignment: ['consignment', 'consignment_number', 'consignment_no', 'tracking_number'],
  settlementDays: ['settlement_due_days', 'settlement_days', 'settlement_due'],
  settlementRate: [
    'settlement_discount_rate',
    'settlement_discount',
    'settlement_discount_percent',
  ],
  salesOrder: ['sales_order', 'sales_order_details', 'sales_order_detail', 'sop'],
} as const

const LINE = {
  position: ['position', 'line_number', 'line_no', 'line', 'sequence', 'seq'],
  stockCode: ['stock_code', 'sku', 'product_code', 'item_code', 'part_number'],
  description: ['description', 'product_name', 'name', 'text', 'details'],
  extraText: [
    'extra_text',
    'extra_description',
    'additional_text',
    'description_2',
    'comment',
  ],
  unitOfSale: ['unit_of_sale', 'unit', 'uom', 'unit_of_measure'],
  quantity: ['quantity', 'qty'],
  unitPrice: ['unit_price', 'price', 'sell_price'],
  discountRate: ['discount_rate', 'discount_percent', 'discount_pct'],
  discountAmount: ['discount_amount', 'discount', 'discount_value'],
  net: ['net', 'net_amount', 'net_value', 'line_net'],
  taxCode: ['tax_code', 'vat_code'],
  taxRate: ['tax_rate', 'vat_rate'],
  tax: ['tax', 'tax_amount', 'vat', 'vat_amount', 'line_tax'],
  gross: ['gross', 'gross_amount', 'gross_value', 'line_total', 'total'],
  nominal: ['nominal_code', 'nominal', 'nominal_ledger'],
  deliveryDate: ['delivery_date', 'despatch_date', 'dispatch_date'],
  image: ['image_url', 'image', 'picture_url'],
  crmProduct: ['crm_product', 'product', 'crm', 'product_info', 'crm_product_info'],
  textFlag: ['is_text_line', 'text_line', 'is_text', 'text_only'],
} as const

const PRODUCT = {
  id: ['id', 'product_id', 'crm_product_id', 'uuid'],
  title: ['title', 'name', 'product_name'],
  handle: ['handle'],
  status: ['status'],
  image: ['image_url', 'featured_image_url', 'image'],
} as const

/** Keys the page lays out itself (so they are not repeated in "More details"). */
const STRUCTURAL = new Set(
  [
    ...N.invoiceAddress,
    ...N.deliveryAddress,
    ...N.lines,
    ...N.vat,
    ...N.payments,
    ...N.salesOrder,
    'customer',
    'account',
    'totals',
    'summary',
    'payment',
    'crm_customer',
  ].map(norm),
)
const KNOWN = new Set(Object.values(N).flat().map(norm))

// ---------------------------------------------------------------------------- readers

/** "contact_name" → "Contact name": a field name written for people. */
export function fieldLabel(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key
}

/** A plain value as text ("" for none); lists of plain values are joined. */
export function plainText(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    return value.map(plainText).filter(Boolean).join(', ')
  }
  return text(value)
}

function scalarFields(
  object: Raw,
  skip: ReadonlySet<string> = new Set(),
): [string, string][] {
  const fields: [string, string][] = []
  for (const [key, value] of Object.entries(object)) {
    if (skip.has(norm(key))) continue
    if (isRaw(value) || (Array.isArray(value) && value.some((item) => isRaw(item))))
      continue
    const shown = plainText(value)
    if (shown) fields.push([fieldLabel(key), shown])
  }
  return fields
}

const ADDRESS_LINE_NAMES = [
  ['name', 'company', 'company_name', 'contact'],
  ['address1', 'address_1', 'line1', 'line_1', 'street'],
  ['address2', 'address_2', 'line2', 'line_2'],
  ['address3', 'address_3', 'line3', 'line_3'],
  ['address4', 'address_4', 'line4', 'line_4'],
  ['city', 'town'],
  ['county', 'region', 'state', 'province'],
  ['postcode', 'post_code', 'zip', 'postal_code'],
  ['country', 'country_name', 'country_code'],
] as const

export function readAddress(value: unknown): InvoiceAddress | null {
  if (typeof value === 'string') {
    const lines = value
      .split(/\r?\n|,\s*/)
      .map((line) => line.trim())
      .filter(Boolean)
    return lines.length > 0 ? { lines, fields: [] } : null
  }
  if (Array.isArray(value)) {
    const lines = value.map(plainText).filter(Boolean)
    return lines.length > 0 ? { lines, fields: [] } : null
  }
  if (!isRaw(value)) return null

  // The API's own formatting, when it sends one.
  const formatted = lookup(
    [value],
    [
      'formatted_lines',
      'formatted_address',
      'formatted',
      'lines',
      'display',
      'full_address',
    ],
  )
  let lines: string[] = []
  if (Array.isArray(formatted)) lines = formatted.map(plainText).filter(Boolean)
  else if (typeof formatted === 'string') {
    lines = formatted
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  }
  if (lines.length === 0) {
    for (const names of ADDRESS_LINE_NAMES) {
      const part = text(lookup([value], names))
      if (part) lines.push(part)
    }
  }
  const skip = new Set(
    [
      'formatted_lines',
      'formatted_address',
      'formatted',
      'lines',
      'display',
      'full_address',
    ].map(norm),
  )
  const fields = scalarFields(value, skip)
  return lines.length === 0 && fields.length === 0 ? null : { lines, fields }
}

function readCrmProduct(value: unknown): InvoiceCrmProduct | null {
  if (!isRaw(value)) return null
  const title = text(lookup([value], PRODUCT.title))
  const id = text(lookup([value], PRODUCT.id)) || null
  if (!title && !id) return null
  return {
    id,
    title,
    handle: text(lookup([value], PRODUCT.handle)),
    status: text(lookup([value], PRODUCT.status)),
    imageUrl: text(lookup([value], PRODUCT.image)) || null,
  }
}

function readLine(raw: Raw, index: number): InvoiceLine {
  const crmProduct = readCrmProduct(lookup([raw], LINE.crmProduct))
  const stockCode = text(lookup([raw], LINE.stockCode))
  const quantity = toNumber(lookup([raw], LINE.quantity))
  const net = toNumber(lookup([raw], LINE.net))
  const flagged = toFlag(lookup([raw], LINE.textFlag))
  const kind = canonicalKey(lookup([raw], ['line_type', 'type', 'kind']))
  return {
    position: text(lookup([raw], LINE.position)) || String(index + 1),
    imageUrl: text(lookup([raw], LINE.image)) || crmProduct?.imageUrl || null,
    stockCode,
    description: text(lookup([raw], LINE.description)),
    extraText: text(lookup([raw], LINE.extraText)),
    unitOfSale: text(lookup([raw], LINE.unitOfSale)),
    quantity,
    unitPrice: toNumber(lookup([raw], LINE.unitPrice)),
    discountRate: toNumber(lookup([raw], LINE.discountRate)),
    discountAmount: toNumber(lookup([raw], LINE.discountAmount)),
    net,
    taxCode: text(lookup([raw], LINE.taxCode)),
    taxRate: toNumber(lookup([raw], LINE.taxRate)),
    tax: toNumber(lookup([raw], LINE.tax)),
    gross: toNumber(lookup([raw], LINE.gross)),
    nominalCode: text(lookup([raw], LINE.nominal)),
    deliveryDate: text(lookup([raw], LINE.deliveryDate)) || null,
    isTextLine:
      flagged ??
      (kind === 'text' || (stockCode === '' && quantity === null && net === null)),
    crmProduct,
  }
}

function readVat(value: unknown): InvoiceVatRow[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRaw).map((row) => ({
    rate: text(lookup([row], ['rate', 'vat_rate', 'tax_rate', 'code', 'tax_code'])),
    net: toNumber(lookup([row], ['net', 'net_amount', 'net_value', 'goods'])),
    tax: toNumber(lookup([row], ['tax', 'tax_amount', 'vat', 'vat_amount'])),
  }))
}

function timeOrNull(value: unknown): string | null {
  return text(value) || null
}

/** The whole answer. An answer that is not an invoice at all is refused with a readable message. */
export function readInvoiceDetail(data: unknown): InvoiceDetail {
  // The invoice may be the answer itself or sit under `invoice` / `result` / `data`.
  const wrapped = isRaw(data)
    ? [data.invoice, data.result, data.data].find(isRaw)
    : undefined
  const root = isRaw(data) ? (wrapped ?? data) : null
  if (!root) throw new ApiError('The invoice answer was not in the expected form.')

  const children = childrenOf(root)
  const general = [root, ...children]
  const customerObject = [root.customer, root.account, root.customer_details].find(
    isRaw,
  ) as Raw | undefined
  const customerScopes = [customerObject, root, ...children]
  const totalsObject = [root.totals, root.summary, root.amounts].find(isRaw) as
    Raw | undefined
  const summaryScopes = [totalsObject, root, ...children]
  const paymentObject = [root.payment, root.payment_info, root.payment_details].find(
    isRaw,
  ) as Raw | undefined
  const paymentScopes = [paymentObject, root, ...children]

  const number = text(lookup([root], N.number))
  if (!number && !lookup([root], N.lines)) {
    throw new ApiError(
      'The invoice answer was not in the expected form (no invoice number).',
    )
  }

  const posted = lookup(general, N.posted)
  const postedFlag = toFlag(posted)
  const linesRaw = lookup([root], N.lines)
  const crmId = lookup(customerScopes, N.crmCustomerId)

  const salesOrderRaw = lookup([root], N.salesOrder)
  const detail: InvoiceDetail = {
    number,
    kind: canonicalKey(lookup([root], N.kind)),
    kindLabel: text(lookup([root], N.kindLabel)),
    date: timeOrNull(lookup([root], N.date)),
    createdAt: timeOrNull(lookup([root], N.createdAt)),
    currency: text(lookup(general, N.currency)) || null,
    posted: postedFlag,
    postedText: postedFlag === null ? text(posted) : '',
    printed: (() => {
      const value = lookup(general, N.printed)
      const flag = toFlag(value)
      return flag === null ? text(value) : flag ? 'Printed' : 'Not printed'
    })(),
    customerOrderNumber: text(lookup(general, N.customerOrder)),
    takenBy: text(lookup(general, N.takenBy)),
    fromSalesOrder: plainText(lookup([root], N.fromSalesOrder)),
    quoteStatus: text(lookup(general, N.quoteStatus)),
    quoteExpiry: timeOrNull(lookup(general, N.quoteExpiry)),
    customer: {
      name: text(lookup(customerScopes, N.custName)),
      accountRef: text(lookup(customerScopes, N.accountRef)),
      contactName: text(lookup(customerScopes, N.contactName)),
      telephone: text(lookup(customerScopes, N.telephone)),
      telephone2: text(lookup(customerScopes, N.telephone2)),
      email: text(lookup(customerScopes, N.email)),
      vatNumber: text(lookup(customerScopes, N.vatNumber)),
      countryCode: text(lookup(customerScopes, N.countryCode)),
      creditLimit: toNumber(lookup(customerScopes, N.creditLimit)),
      balance: toNumber(lookup(customerScopes, N.balance)),
      onHold: toFlag(lookup(customerScopes, N.onHold)),
      paymentDueDays: text(lookup(customerScopes, N.paymentDueDays)),
      crmCustomerId: isRaw(crmId) ? text(lookup([crmId], ['id', 'uuid'])) : text(crmId),
    },
    invoiceAddress: readAddress(
      lookup([root, ...(customerObject ? [customerObject] : [])], N.invoiceAddress),
    ),
    deliveryAddress: readAddress(
      lookup([root, ...(customerObject ? [customerObject] : [])], N.deliveryAddress),
    ),
    lines: Array.isArray(linesRaw)
      ? linesRaw.filter(isRaw).map((line, index) => readLine(line, index))
      : [],
    summary: {
      itemsNet: toNumber(lookup(summaryScopes, N.itemsNet)),
      itemsTax: toNumber(lookup(summaryScopes, N.itemsTax)),
      discountNet: toNumber(lookup(summaryScopes, N.discountNet)),
      discountDescription: text(lookup(summaryScopes, N.discountDescription)),
      carriageNet: toNumber(lookup(summaryScopes, N.carriageNet)),
      carriageTax: toNumber(lookup(summaryScopes, N.carriageTax)),
      carriageGross: toNumber(lookup(summaryScopes, N.carriageGross)),
      totalNet: toNumber(lookup(summaryScopes, N.totalNet)),
      totalTax: toNumber(lookup(summaryScopes, N.totalTax)),
      totalGross: toNumber(lookup(summaryScopes, N.totalGross)),
      prepaid: toNumber(lookup(summaryScopes, N.prepaid)),
    },
    vat: readVat(lookup([root, ...(totalsObject ? [totalsObject] : [])], N.vat)),
    payment: {
      status: canonicalKey(lookup(paymentScopes, N.payStatus)),
      paid: toNumber(lookup(paymentScopes, N.paid)),
      outstanding: toNumber(lookup(paymentScopes, N.outstanding)),
      dueDate: timeOrNull(lookup(paymentScopes, N.dueDate)),
      overdue: toFlag(lookup(paymentScopes, N.overdue)),
      daysOverdue: toNumber(lookup(paymentScopes, N.daysOverdue)),
      ledgerTransaction: plainText(lookup(paymentScopes, N.ledger)),
    },
    payments: (() => {
      const value = lookup([root, ...(paymentObject ? [paymentObject] : [])], N.payments)
      return Array.isArray(value) ? value.filter(isRaw) : []
    })(),
    additional: {
      notes: plainText(lookup(general, N.notes)),
      courier: text(lookup(general, N.courier)),
      consignment: text(lookup(general, N.consignment)),
      settlementDueDays: text(lookup(general, N.settlementDays)),
      settlementDiscountRate: text(lookup(general, N.settlementRate)),
    },
    salesOrder: isRaw(salesOrderRaw) ? scalarFields(salesOrderRaw) : null,
    moreFields: [],
  }

  // Whatever the page has no place for is still shown: plain top-level fields, and those of the
  // objects it does not lay out itself ("Group · Field").
  const more: [string, string][] = scalarFields(root, new Set([...STRUCTURAL, ...KNOWN]))
  for (const [key, value] of Object.entries(root)) {
    if (!isRaw(value) || STRUCTURAL.has(norm(key))) continue
    for (const [label, shown] of scalarFields(value, KNOWN)) {
      more.push([`${fieldLabel(key)} · ${label}`, shown])
    }
  }
  detail.moreFields = more
  return detail
}
