import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_CARD,
  DETAIL_TD,
  DETAIL_TH,
  DetailEmpty,
  DetailSection,
  Field,
} from '../../../components/ui/DetailSection.tsx'
import {
  CreditCardIcon,
  EyeIcon,
  FileTextIcon,
  LayersIcon,
  MapPinIcon,
  PoundIcon,
  ProductsIcon,
  TruckIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { ROW_ACTION, ROW_ACTION_ICON } from '../../../components/ui/rowActions.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import type { SageOrderDetail, SageOrderLine } from '../../../lib/api/sageOrders.ts'
import { count, dateText, money, paymentPill, percent } from '../utils/format.ts'
import { customerPath, invoicePath } from '../utils/paths.ts'

const NUMBER_TD = `${DETAIL_TD} text-right tabular-nums`
const NUMBER_TH = `${DETAIL_TH} text-right`
/** The shared heading style without its own `text-left`, for a heading that is centred. */
const INV_TH_PLAIN = DETAIL_TH.replace('text-left', '')

const LINK = 'text-text hover:text-accent font-semibold no-underline hover:underline'

const copyable = (value: string, label: string) =>
  value ? (
    <span className="flex items-center gap-1.5">
      <span className="break-all">{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  ) : null

/** A label and a value on one line, the value on the right (the amount summary). */
function Row({
  label,
  children,
  strong = false,
}: {
  label: string
  children: ReactNode
  strong?: boolean
}) {
  return (
    <div
      className={`border-border flex items-baseline justify-between gap-4 border-b py-2.5 text-[0.85rem] last:border-b-0 ${
        strong ? 'font-bold' : ''
      }`}
    >
      <dt className={strong ? '' : 'text-text-muted'}>{label}</dt>
      <dd className="m-0 min-w-0 text-right break-words tabular-nums">{children}</dd>
    </div>
  )
}

/** An address as the API formats it: the name on its own line, then the rest on one line. */
function AddressBlock({ lines, emptyText }: { lines: string[]; emptyText: string }) {
  if (lines.length === 0) {
    return <p className="text-text-muted m-0 text-[0.85rem]">{emptyText}</p>
  }
  const [name, ...rest] = lines
  const street = rest.join(', ')
  return (
    <address className="m-0 text-[0.92rem] leading-relaxed font-semibold not-italic">
      <span className="block break-words">{name}</span>
      {street && <span className="block break-words">{street}</span>}
    </address>
  )
}

// ---------------------------------------------------------------------------- Overview

/** The days of the settlement terms, as the API sent them. */
const daysText = (value: number | null) =>
  value === null ? '' : `${value.toLocaleString('en-GB')} ${value === 1 ? 'day' : 'days'}`

/** Label-over-value fields in as many columns as the card is wide, tightly spaced. */
const FIELDS = 'm-0 grid grid-cols-1 gap-x-5 gap-y-3 min-[520px]:grid-cols-2'

/**
 * The Overview tab — the whole of what the order says about itself on one compact screen: the customer
 * and the CRM customer, the invoice and delivery addresses beside the order's notes, then the delivery
 * and payment terms (courier, consignment, payment reference, settlement). Small cards, tight spacing.
 */
export function OverviewPanel({ detail }: { detail: SageOrderDetail }) {
  const c = detail.customer
  const crm = detail.crm_customer
  const a = detail.amounts
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DetailSection compact title="Customer Information" icon={UsersIcon}>
          <dl className={`${FIELDS} xl:grid-cols-3`}>
            <Field label="Customer name">
              {c.account_ref && c.name ? (
                <Link
                  to={customerPath(c.account_ref)}
                  state={{ linkedName: c.name }}
                  className={LINK}
                >
                  {c.name}
                </Link>
              ) : (
                c.name
              )}
            </Field>
            <Field label="Account reference">
              {copyable(c.account_ref, 'Copy account reference')}
            </Field>
            <Field label="Contact name">{detail.contact_name}</Field>
            <Field label="Telephone">{detail.telephone}</Field>
            <Field label="Customer order number">{detail.customer_order_number}</Field>
            <Field label="VAT registration number">{detail.vat_reg_number}</Field>
            <Field label="Taken by">{detail.taken_by}</Field>
          </dl>
        </DetailSection>

        <DetailSection compact title="CRM Customer" icon={UsersIcon}>
          {crm ? (
            <dl className={FIELDS}>
              <Field label="Name">
                {crm.id && crm.name ? (
                  <Link
                    to={`/customers/${encodeURIComponent(crm.id)}`}
                    state={{ linkedName: crm.name }}
                    className={LINK}
                  >
                    {crm.name}
                  </Link>
                ) : (
                  crm.name
                )}
              </Field>
              <Field label="Orders">{crm.orders_count?.toLocaleString('en-GB')}</Field>
              <div className="min-w-0 min-[520px]:col-span-2">
                <Field label="Email">
                  {crm.email ? (
                    <a
                      href={`mailto:${crm.email}`}
                      className="text-text hover:text-accent break-all no-underline hover:underline"
                    >
                      {crm.email}
                    </a>
                  ) : null}
                </Field>
              </div>
              <Field label="Total spent">
                {crm.total_spent === null ? '' : money(crm.total_spent, detail.currency)}
              </Field>
              <Field label="CRM customer ID">
                {copyable(crm.id, 'Copy CRM customer ID')}
              </Field>
            </dl>
          ) : (
            <p className="text-text-muted m-0 text-[0.85rem]">
              This customer is not linked to a CRM customer.
            </p>
          )}
        </DetailSection>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <DetailSection compact title="Invoice Address" icon={MapPinIcon}>
          <AddressBlock
            lines={detail.invoice_address.lines}
            emptyText="No invoice address."
          />
        </DetailSection>
        <DetailSection compact title="Delivery Address" icon={TruckIcon}>
          <AddressBlock
            lines={detail.delivery_address.lines}
            emptyText="No delivery address."
          />
        </DetailSection>
        <DetailSection
          compact
          title="Order Notes"
          icon={FileTextIcon}
          count={detail.notes.length}
        >
          {detail.notes.length > 0 ? (
            <ul className="m-0 flex max-h-40 list-none flex-col gap-1.5 overflow-y-auto p-0">
              {detail.notes.map((note, index) => (
                <li
                  key={index}
                  className="bg-surface border-border rounded-md border px-3 py-2 text-[0.82rem] leading-snug font-medium break-words whitespace-pre-wrap"
                >
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted m-0 text-[0.85rem]">
              No notes have been added.
            </p>
          )}
        </DetailSection>
      </div>

      <DetailSection compact title="Delivery & Payment" icon={CreditCardIcon}>
        <dl className="m-0 grid grid-cols-1 gap-x-5 gap-y-3 min-[520px]:grid-cols-2 lg:grid-cols-5">
          <Field label="Courier">{detail.courier}</Field>
          <Field label="Consignment number">
            {copyable(detail.consignment, 'Copy consignment number')}
          </Field>
          <Field label="Payment reference">
            {copyable(detail.payment_reference, 'Copy payment reference')}
          </Field>
          <Field label="Settlement due">{daysText(a?.settlement_due_days ?? null)}</Field>
          <Field label="Settlement discount">
            {a?.settlement_discount_rate === null ||
            a?.settlement_discount_rate === undefined
              ? ''
              : percent(a.settlement_discount_rate)}
          </Field>
        </dl>
      </DetailSection>
    </div>
  )
}

// ---------------------------------------------------------------------------- Items

/** The product's picture, small, from an https address only. */
function Thumb({ url }: { url: string }) {
  const src = safeUrl(url)
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="bg-surface border-border text-text-muted flex size-8 shrink-0 items-center justify-center rounded border"
      >
        <ProductsIcon width={14} height={14} />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="border-border size-8 shrink-0 rounded border object-cover"
    />
  )
}

/** The product's title: a link to the CRM product when the line is linked to one. */
function ProductCell({ line }: { line: SageOrderLine }) {
  const product = line.product
  const title = product?.title || line.description
  const extra = [line.extra_text, ...line.comments].filter(Boolean)
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Thumb url={product?.image_url ?? ''} />
      <div className="min-w-0">
        {product?.product_id ? (
          <Link
            to={`/products/${encodeURIComponent(product.product_id)}`}
            className="text-text hover:text-accent font-medium break-words no-underline hover:underline"
          >
            {title || '—'}
          </Link>
        ) : (
          <span className="font-medium break-words">{title || '—'}</span>
        )}
        {extra.map((text, index) => (
          <p key={index} className="text-text-muted m-0 text-[0.78rem] break-words">
            {text}
          </p>
        ))}
      </div>
    </div>
  )
}

/** The order's products, in a table that scrolls sideways when the window is narrower than it. */
function ItemsTable({ lines, currency }: { lines: SageOrderLine[]; currency: string }) {
  if (lines.length === 0) {
    return <DetailEmpty icon={ProductsIcon}>This order has no items.</DetailEmpty>
  }
  // A discount column only when some line has a discount.
  const hasDiscount = lines.some(
    (line) => !line.is_text_line && (line.discount_amount ?? 0) !== 0,
  )
  const span = hasDiscount ? 11 : 10
  return (
    <div className={`${DETAIL_CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${INV_TH_PLAIN} w-16 text-center`}>No.</th>
              <th className={`${DETAIL_TH} w-28`}>Stock code</th>
              <th className={DETAIL_TH}>Product</th>
              <th className={`${DETAIL_TH} w-24`}>Unit of sale</th>
              <th className={`${NUMBER_TH} w-20`}>Ordered</th>
              <th className={`${NUMBER_TH} w-24`}>Allocated</th>
              <th className={`${NUMBER_TH} w-24`}>Despatched</th>
              <th className={`${NUMBER_TH} w-24`}>Outstanding</th>
              <th className={`${NUMBER_TH} w-24`}>Unit price</th>
              {hasDiscount && <th className={`${NUMBER_TH} w-24`}>Discount</th>}
              <th className={`${NUMBER_TH} w-24`}>Net</th>
              <th className={`${NUMBER_TH} w-24`}>Tax</th>
              <th className={`${NUMBER_TH} w-24`}>Gross</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={`${line.position}-${index}`}
                className="border-border even:bg-surface/60 border-b align-top last:border-b-0"
              >
                <td className={`${DETAIL_TD} text-text-muted text-center`}>
                  {line.position || '—'}
                </td>
                <td
                  className={`${DETAIL_TD} truncate font-medium`}
                  title={line.stock_code}
                >
                  {line.stock_code || '—'}
                </td>
                {line.is_text_line ? (
                  <td
                    colSpan={span}
                    className={`${DETAIL_TD} text-text-muted !whitespace-normal italic`}
                  >
                    {[line.description, line.extra_text, ...line.comments]
                      .filter(Boolean)
                      .join(' — ') || '—'}
                  </td>
                ) : (
                  <>
                    <td className={`${DETAIL_TD} !whitespace-normal`}>
                      <ProductCell line={line} />
                    </td>
                    <td className={DETAIL_TD}>{line.unit_of_sale || '—'}</td>
                    <td className={NUMBER_TD}>{count(line.qty_ordered)}</td>
                    <td className={NUMBER_TD}>{count(line.qty_allocated)}</td>
                    <td className={NUMBER_TD}>{count(line.qty_despatched)}</td>
                    <td className={NUMBER_TD}>{count(line.qty_outstanding)}</td>
                    <td className={NUMBER_TD}>{money(line.unit_price, currency)}</td>
                    {hasDiscount && (
                      <td className={NUMBER_TD}>
                        {money(line.discount_amount, currency)}
                      </td>
                    )}
                    <td className={NUMBER_TD}>{money(line.net, currency)}</td>
                    <td className={NUMBER_TD}>{money(line.tax, currency)}</td>
                    <td className={`${NUMBER_TD} font-semibold`}>
                      {money(line.gross, currency)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Tax, nominal code, delivery dates, what is left to despatch and the stock position of each product line. */
function LineDetailsTable({ lines }: { lines: SageOrderLine[] }) {
  const productLines = lines.filter((line) => !line.is_text_line)
  if (productLines.length === 0) return null
  return (
    <DetailSection title="Line Details" icon={LayersIcon} count={productLines.length}>
      <div className={`${DETAIL_CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                <th className={DETAIL_TH}>Stock code</th>
                <th className={DETAIL_TH}>Tax code</th>
                <th className={NUMBER_TH}>Tax rate</th>
                <th className={DETAIL_TH}>Nominal code</th>
                <th className={DETAIL_TH}>Delivery date</th>
                <th className={DETAIL_TH}>Due date</th>
                <th className={NUMBER_TH}>To despatch</th>
                <th className={NUMBER_TH}>In stock</th>
                <th className={NUMBER_TH}>Allocated</th>
                <th className={NUMBER_TH}>Free</th>
                <th className={NUMBER_TH}>On order</th>
              </tr>
            </thead>
            <tbody>
              {productLines.map((line, index) => (
                <tr
                  key={`${line.position}-${index}`}
                  className="border-border even:bg-surface/60 border-b last:border-b-0"
                >
                  <td className={`${DETAIL_TD} font-medium`}>{line.stock_code || '—'}</td>
                  <td className={DETAIL_TD}>{line.tax_code || '—'}</td>
                  <td className={NUMBER_TD}>{percent(line.tax_rate)}</td>
                  <td className={DETAIL_TD}>{line.nominal_code || '—'}</td>
                  <td className={DETAIL_TD}>{dateText(line.delivery_date)}</td>
                  <td className={DETAIL_TD}>{dateText(line.due_date)}</td>
                  <td className={NUMBER_TD}>{count(line.qty_to_despatch)}</td>
                  <td className={NUMBER_TD}>{count(line.stock?.in_stock)}</td>
                  <td className={NUMBER_TD}>{count(line.stock?.allocated)}</td>
                  <td className={NUMBER_TD}>{count(line.stock?.free)}</td>
                  <td className={NUMBER_TD}>{count(line.stock?.on_order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DetailSection>
  )
}

/** A label and a bold amount on one line (the VAT card). */
function VatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0">
      <dt className="text-text-muted text-[0.7rem] font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="m-0 text-[0.92rem] font-bold tabular-nums">{children}</dd>
    </div>
  )
}

/** The Items tab: the products, the line details, then the amount summary and the VAT analysis. */
export function ItemsPanel({ detail }: { detail: SageOrderDetail }) {
  const currency = detail.currency
  const a = detail.amounts
  const vat = a?.vat_analysis ?? []
  const vatNet = vat.reduce((sum, row) => sum + (row.net ?? 0), 0)
  const vatTax = vat.reduce((sum, row) => sum + (row.tax ?? 0), 0)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ItemsTable lines={detail.lines} currency={currency} />
      <LineDetailsTable lines={detail.lines} />

      {a && (
        <div className="grid gap-4 lg:grid-cols-2">
          <DetailSection title="Amount Summary" icon={PoundIcon}>
            <dl className="m-0">
              <Row label="Items net">{money(a.items_net, currency)}</Row>
              <Row label="Items tax">{money(a.items_tax, currency)}</Row>
              <Row label="Items gross">{money(a.items_gross, currency)}</Row>
              <Row
                label={
                  a.discount_description
                    ? `Discount · ${a.discount_description}`
                    : a.discount_rate
                      ? `Discount · ${percent(a.discount_rate)}`
                      : 'Discount'
                }
              >
                {money(a.discount_net, currency)}
              </Row>
              <Row label="Carriage net">{money(a.carriage_net, currency)}</Row>
              <Row label="Carriage tax">{money(a.carriage_tax, currency)}</Row>
              <Row label="Carriage gross">{money(a.carriage_gross, currency)}</Row>
              <Row label="Total net" strong>
                {money(a.net, currency)}
              </Row>
              <Row label="Total tax" strong>
                {money(a.tax, currency)}
              </Row>
              <Row label="Total gross" strong>
                {money(a.gross, currency)}
              </Row>
              <Row label="Amount prepaid">{money(a.amount_prepaid, currency)}</Row>
            </dl>
          </DetailSection>

          <DetailSection title="VAT Analysis" icon={LayersIcon}>
            {vat.length === 0 ? (
              <p className="text-text-muted m-0 text-[0.85rem]">No VAT analysis.</p>
            ) : (
              <dl className="m-0">
                {/* Several rates: each one's own net and tax first, then the totals. */}
                {vat.length > 1 &&
                  vat.map((row, index) => (
                    <VatRow
                      key={`${row.rate}-${index}`}
                      label={`${row.rate === null ? 'Rate' : percent(row.rate)} · net / tax`}
                    >
                      {money(row.net, currency)} / {money(row.tax, currency)}
                    </VatRow>
                  ))}
                {vat.length === 1 && (
                  <VatRow label="VAT rate">{percent(vat[0].rate)}</VatRow>
                )}
                <VatRow label="Net amount">{money(vatNet, currency)}</VatRow>
                <VatRow label="Tax amount">{money(vatTax, currency)}</VatRow>
                <VatRow label="Gross amount">{money(vatNet + vatTax, currency)}</VatRow>
              </dl>
            )}
          </DetailSection>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------- Invoices

// Fixed column widths (the table is fixed-layout), so every heading sits over its cells.
// The shared header style has its own `text-left`; each heading here sets its alignment alone, so the
// two never fight and a heading always sits the way its cells do.
const INV_TH = `${DETAIL_TH.replace('text-left', '')} sticky top-0 z-[1] backdrop-blur`

/**
 * The Invoices tab: the invoices raised for the order in a table that takes the height the page gives it
 * (from `lg` the box scrolls under a sticky header, the pagination stays fixed beneath it), each invoice
 * opening in this same page as a tab. The paging is the shared footer — 10 / 25 / 50 / 100 a page — done
 * here because the order's answer carries every invoice at once.
 */
export function InvoicesPanel({ detail }: { detail: SageOrderDetail }) {
  const currency = detail.currency
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  if (detail.invoices.length === 0) {
    return (
      <DetailEmpty icon={FileTextIcon}>
        No invoice has been raised for this order.
      </DetailEmpty>
    )
  }

  const total = detail.invoices.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  const rows = detail.invoices.slice((current - 1) * pageSize, current * pageSize)

  return (
    <section
      aria-label="Invoices"
      className={`${DETAIL_CARD} flex min-w-0 flex-col overflow-hidden lg:min-h-0 lg:flex-1`}
    >
      <div className="relative min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${INV_TH} w-[22%] text-left`}>Invoice number</th>
              <th className={`${INV_TH} w-[18%] text-left`}>Invoice date</th>
              <th className={`${INV_TH} w-[16%] text-right`}>Gross</th>
              <th className={`${INV_TH} w-[16%] text-right`}>Outstanding</th>
              <th className={`${INV_TH} w-[18%] text-center`}>Payment status</th>
              <th className={`${INV_TH} w-[10%] text-center`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((invoice, index) => {
              const pill = paymentPill(invoice.payment_status)
              return (
                <tr
                  key={`${invoice.invoice_number}-${index}`}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  <td className={`${DETAIL_TD} truncate`}>
                    {invoice.invoice_number ? (
                      <Link
                        to={invoicePath(invoice.invoice_number)}
                        state={{ linkedName: invoice.invoice_number }}
                        className={LINK}
                      >
                        {invoice.invoice_number}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={DETAIL_TD}>{dateText(invoice.invoice_date)}</td>
                  <td className={`${NUMBER_TD} font-semibold`}>
                    {money(invoice.gross, currency)}
                  </td>
                  <td className={NUMBER_TD}>{money(invoice.outstanding, currency)}</td>
                  <td className={`${DETAIL_TD} text-center`}>
                    {invoice.payment_status ? (
                      <Badge tone={pill.tone} className="w-[6.5rem] justify-center">
                        {pill.label}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${DETAIL_TD} text-center`}>
                    {invoice.invoice_number && (
                      <Link
                        to={invoicePath(invoice.invoice_number)}
                        state={{ linkedName: invoice.invoice_number }}
                        aria-label={`View invoice ${invoice.invoice_number}`}
                        title="View"
                        className={ROW_ACTION}
                      >
                        <EyeIcon width={ROW_ACTION_ICON} height={ROW_ACTION_ICON} />
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <PaginationFooter
        page={current}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
      />
    </section>
  )
}
