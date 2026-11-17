import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import {
  DETAIL_CARD,
  DETAIL_TD,
  DETAIL_TH,
  DetailEmpty,
  DetailSection,
  DetailSkeleton,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  GridIcon,
  ImageIcon,
  PoundIcon,
  ProductsIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type {
  InvoiceAddress,
  InvoiceDetail,
  InvoiceLine,
} from '../../../lib/api/invoiceDetail.ts'
import { fieldLabel } from '../../../lib/api/invoiceDetail.ts'
import type { Invoice } from '../../../lib/api/invoices.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { useInvoiceDetail } from '../hooks/useInvoiceDetail.ts'
import {
  dateOrTime,
  kindLabel,
  looseValue,
  money,
  paymentLabel,
  paymentTone,
  percent,
  quantity,
} from '../utils/format.ts'
import { customerPath } from '../utils/paths.ts'
import { DetailPage } from './DetailPage.tsx'

interface InvoiceDetailsViewProps {
  /** The invoice's number, as in the address — what the details are asked for by. */
  reference: string
  /** Its document type when the address has one (it only helps to find the row in the list). */
  kind: string | null
  /** The list row, when the page was opened from the list: it draws the header while the details load. */
  preview: Invoice | null
  onBack: () => void
  /** Told the invoice's number once it is known, so the page can name its tab. */
  onLoaded?: (number: string) => void
}

const SMALL_TEXT = 'text-[0.82rem]'

/** A label and a value on one line, the value on the right (the summary-style cards). */
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

const copyable = (value: string, label: string) =>
  value ? (
    <span className="flex items-center gap-1.5">
      <span className="break-all">{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  ) : null

/** Yes / No as a badge; nothing when the API did not say. */
function FlagBadge({
  value,
  yes,
  no,
  yesTone = 'warning',
  noTone = 'success',
}: {
  value: boolean | null
  yes: string
  no: string
  yesTone?: 'warning' | 'danger' | 'success' | 'neutral'
  noTone?: 'warning' | 'danger' | 'success' | 'neutral'
}) {
  if (value === null) return null
  return <Badge tone={value ? yesTone : noTone}>{value ? yes : no}</Badge>
}

/** An address: the API's formatted lines first, then every field it sent. */
function AddressBlock({
  address,
  emptyText,
}: {
  address: InvoiceAddress | null
  emptyText: string
}) {
  if (!address) return <p className="text-text-muted m-0 text-[0.85rem]">{emptyText}</p>
  return (
    <div className="flex flex-col gap-3">
      {address.lines.length > 0 && (
        <address className="m-0 text-[0.88rem] leading-relaxed font-medium not-italic">
          {address.lines.map((line, index) => (
            <span key={`${line}-${index}`} className="block break-words">
              {line}
            </span>
          ))}
        </address>
      )}
      {address.fields.length > 0 && (
        <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2.5 min-[420px]:grid-cols-2">
          {address.fields.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-text-muted text-[0.68rem] font-bold tracking-wide uppercase">
                {label}
              </dt>
              <dd className="m-0 text-[0.85rem] font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** A line's picture from the API's `image_url`, or a quiet tile when it has none. */
function LineThumb({ url, alt }: { url: string | null; alt: string }) {
  const src = safeUrl(url)
  return (
    <span className="border-border bg-surface text-text-muted inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageIcon width={16} height={16} />
      )}
    </span>
  )
}

const NUMBER_TD = `${DETAIL_TD} text-right tabular-nums`
const NUMBER_TH = `${DETAIL_TH} text-right`

/** The invoice lines, in a table that scrolls sideways when the window is narrower than it. */
function LinesTable({
  lines,
  currency,
}: {
  lines: InvoiceLine[]
  currency: string | null
}) {
  if (lines.length === 0) {
    return <DetailEmpty icon={ProductsIcon}>This invoice has no lines.</DetailEmpty>
  }
  return (
    <div className={`${DETAIL_CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] border-collapse">
          <thead>
            <tr>
              <th className={`${DETAIL_TH} w-12 text-center`}>Pos</th>
              <th className={`${DETAIL_TH} w-14`}>Image</th>
              <th className={`${DETAIL_TH} w-28`}>Stock code</th>
              <th className={`${DETAIL_TH} min-w-64`}>Product name / description</th>
              <th className={`${DETAIL_TH} w-40`}>Extra text</th>
              <th className={`${DETAIL_TH} w-24`}>Unit of sale</th>
              <th className={`${NUMBER_TH} w-20`}>Qty</th>
              <th className={`${NUMBER_TH} w-24`}>Unit price</th>
              <th className={`${NUMBER_TH} w-20`}>Discount rate</th>
              <th className={`${NUMBER_TH} w-24`}>Discount amount</th>
              <th className={`${NUMBER_TH} w-24`}>Net</th>
              <th className={`${DETAIL_TH} w-20 text-center`}>Tax code</th>
              <th className={`${NUMBER_TH} w-20`}>Tax rate</th>
              <th className={`${NUMBER_TH} w-24`}>Tax</th>
              <th className={`${NUMBER_TH} w-24`}>Gross</th>
              <th className={`${DETAIL_TH} w-24`}>Nominal code</th>
              <th className={`${DETAIL_TH} w-28`}>Delivery date</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={`${line.position}-${index}`}
                className="border-border even:bg-surface/60 border-b align-top last:border-b-0"
              >
                <td className={`${DETAIL_TD} text-text-muted text-center`}>
                  {line.position}
                </td>
                {line.isTextLine ? (
                  <td
                    colSpan={16}
                    className={`${DETAIL_TD} text-text-muted !whitespace-normal italic`}
                  >
                    {[line.description, line.extraText].filter(Boolean).join(' — ') ||
                      '—'}
                  </td>
                ) : (
                  <>
                    <td className={DETAIL_TD}>
                      <LineThumb
                        url={line.imageUrl}
                        alt={line.crmProduct?.title || line.description || line.stockCode}
                      />
                    </td>
                    <td className={`${DETAIL_TD} font-medium`}>
                      {line.stockCode || '—'}
                    </td>
                    <td className={`${DETAIL_TD} !whitespace-normal`}>
                      <span className="block font-medium break-words">
                        {line.description || line.crmProduct?.title || '—'}
                      </span>
                      {line.crmProduct && (
                        <span className="text-text-muted block text-[0.75rem]">
                          CRM product:{' '}
                          {line.crmProduct.id ? (
                            <Link
                              to={`/products/${encodeURIComponent(line.crmProduct.id)}`}
                              className="text-accent no-underline hover:underline"
                            >
                              {line.crmProduct.title || line.crmProduct.handle || 'Open'}
                            </Link>
                          ) : (
                            line.crmProduct.title || line.crmProduct.handle
                          )}
                          {line.crmProduct.status &&
                            ` · ${line.crmProduct.status.toLowerCase()}`}
                        </span>
                      )}
                    </td>
                    <td className={`${DETAIL_TD} break-words !whitespace-normal`}>
                      {line.extraText || '—'}
                    </td>
                    <td className={DETAIL_TD}>{line.unitOfSale || '—'}</td>
                    <td className={NUMBER_TD}>{quantity(line.quantity)}</td>
                    <td className={NUMBER_TD}>{money(line.unitPrice, currency)}</td>
                    <td className={NUMBER_TD}>
                      {line.discountRate ? percent(line.discountRate) : '—'}
                    </td>
                    <td className={NUMBER_TD}>
                      {line.discountAmount ? money(line.discountAmount, currency) : '—'}
                    </td>
                    <td className={NUMBER_TD}>{money(line.net, currency)}</td>
                    <td className={`${DETAIL_TD} text-center`}>{line.taxCode || '—'}</td>
                    <td className={NUMBER_TD}>{percent(line.taxRate)}</td>
                    <td className={NUMBER_TD}>{money(line.tax, currency)}</td>
                    <td className={`${NUMBER_TD} font-semibold`}>
                      {money(line.gross, currency)}
                    </td>
                    <td className={DETAIL_TD}>{line.nominalCode || '—'}</td>
                    <td className={DETAIL_TD}>{dateOrTime(line.deliveryDate)}</td>
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

/** The payment allocations: one column for every field any of them has. */
function PaymentsTable({
  payments,
  currency,
}: {
  payments: Record<string, unknown>[]
  currency: string | null
}) {
  if (payments.length === 0) {
    return (
      <DetailEmpty icon={CreditCardIcon}>
        No payments have been allocated to this invoice.
      </DetailEmpty>
    )
  }
  const keys: string[] = []
  for (const payment of payments) {
    for (const key of Object.keys(payment)) if (!keys.includes(key)) keys.push(key)
  }
  return (
    <div className={`${DETAIL_CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {keys.map((key) => (
                <th key={key} className={DETAIL_TH}>
                  {fieldLabel(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment, index) => (
              <tr
                key={index}
                className="border-border even:bg-surface/60 border-b last:border-b-0"
              >
                {keys.map((key) => (
                  <td key={key} className={DETAIL_TD}>
                    {looseValue(key, payment[key], currency)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * One invoice's page, in place of the list and laid out like a product's: the shared header (a tile,
 * the invoice number, its payment status, the dates and the customer as chips, **Back to list**), a
 * tab strip and clearly labelled cards. The invoice is **asked for by its number when the page opens**
 * (`GET /api/sage/invoices/{invoice_number}`) and the answer is the source of truth; while it loads
 * the header draws from the list row. Tabs: **Overview** (invoice overview, customer, invoice and
 * delivery addresses, the amount summary, the VAT analysis and the payment information), **Line
 * items**, **Payments** (the allocations) and **Additional information** (notes, courier,
 * consignment, settlement terms, the sales order, and any other field the API sent). Empty values show
 * a dash, never a broken layout.
 */
export function InvoiceDetailsView({
  reference,
  kind,
  preview,
  onBack,
  onLoaded,
}: InvoiceDetailsViewProps) {
  const state = useInvoiceDetail(reference)
  const detail = state.detail
  const [tab, setTab] = useState('overview')

  const number = detail?.number || ''
  useEffect(() => {
    if (number) onLoaded?.(number)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when another invoice is known
  }, [number])

  // The answer when it is there, else the list row.
  const currency = detail?.currency ?? preview?.currency ?? null
  const kindText =
    detail?.kindLabel ||
    (detail?.kind || preview?.kind || kind
      ? kindLabel(detail?.kind || preview?.kind || kind || '')
      : 'Invoice')
  const shownNumber = detail?.number || preview?.number || reference
  const paymentStatus = detail?.payment.status || preview?.paymentStatus || ''
  const accountRef = detail?.customer.accountRef || preview?.accountRef || ''
  const customerName = detail?.customer.name || preview?.customerName || accountRef
  const dueDate = detail?.payment.dueDate ?? preview?.dueDate ?? null
  const invoiceDate = detail?.date ?? preview?.date ?? null

  const header = {
    idPrefix: 'invoice',
    visual: (
      <HeaderTile>
        <FileTextIcon width={26} height={26} />
      </HeaderTile>
    ),
    title: `${kindText} ${shownNumber}`,
    titleHint: shownNumber,
    status: (
      <>
        {paymentStatus && (
          <StatusPill
            label={paymentLabel(paymentStatus)}
            tone={paymentTone(paymentStatus)}
          />
        )}
        {detail?.posted !== null && detail?.posted !== undefined && (
          <StatusPill
            label={detail.posted ? 'Posted' : 'Not Posted'}
            tone={detail.posted ? 'success' : 'neutral'}
          />
        )}
        {state.isRefreshing && (
          <span className="text-text-muted text-[0.75rem]" role="status">
            Updating…
          </span>
        )}
      </>
    ),
    chips: (
      <>
        <HeaderChip icon={CalendarIcon} label="Invoice date">
          <span aria-hidden="true" className="text-text-muted">
            Invoice date:
          </span>{' '}
          {dateOrTime(invoiceDate)}
        </HeaderChip>
        <HeaderChip icon={ClockIcon} label="Due date">
          <span aria-hidden="true" className="text-text-muted">
            Due date:
          </span>{' '}
          {dateOrTime(dueDate)}
        </HeaderChip>
        {customerName && (
          <HeaderChip icon={UsersIcon} label="Customer">
            {accountRef ? (
              <Link
                to={customerPath(accountRef)}
                state={{ linkedName: customerName }}
                className="text-text hover:text-accent font-semibold no-underline hover:underline"
              >
                {customerName}
              </Link>
            ) : (
              customerName
            )}
          </HeaderChip>
        )}
        {currency && (
          <HeaderChip icon={PoundIcon} label="Currency">
            <span aria-hidden="true" className="text-text-muted">
              Currency:
            </span>{' '}
            {currency}
          </HeaderChip>
        )}
      </>
    ),
    onBack,
  }

  // Not there (yet): a quiet frame with the header from the list row, and why.
  if (!detail) {
    return (
      <DetailPage
        {...header}
        tabs={[{ id: 'overview', label: 'Overview', icon: GridIcon }]}
        tab="overview"
        onTab={() => {}}
      >
        {state.isPending ? (
          <>
            <span role="status" className="sr-only">
              Loading invoice {reference}…
            </span>
            <DetailSkeleton />
          </>
        ) : (
          <div className="text-text-muted flex flex-col items-center gap-3 py-10 text-center text-[0.9rem]">
            <AlertTriangleIcon width={28} height={28} className="text-danger" />
            <p className="text-text m-0 font-semibold">
              {state.notFound ? 'Invoice not found' : 'Couldn’t load this invoice'}
            </p>
            <p className="m-0">
              {state.notFound
                ? `There is no invoice numbered “${reference}”.`
                : (state.error ?? 'Something went wrong.')}
            </p>
            {!state.notFound && (
              <button
                type="button"
                onClick={state.retry}
                className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </DetailPage>
    )
  }

  return (
    <DetailPage
      {...header}
      tabs={[
        { id: 'overview', label: 'Overview', icon: GridIcon },
        {
          id: 'lines',
          label: 'Line items',
          icon: ProductsIcon,
          count: detail.lines.length,
        },
        {
          id: 'payments',
          label: 'Payments',
          icon: CreditCardIcon,
          count: detail.payments.length,
        },
        { id: 'additional', label: 'Additional information', icon: FileTextIcon },
      ]}
      tab={tab}
      onTab={setTab}
    >
      {tab === 'overview' && <Overview detail={detail} currency={currency} />}
      {tab === 'lines' && <LinesTable lines={detail.lines} currency={currency} />}
      {tab === 'payments' && (
        <PaymentsTable payments={detail.payments} currency={currency} />
      )}
      {tab === 'additional' && <Additional detail={detail} currency={currency} />}
    </DetailPage>
  )
}

function Overview({
  detail,
  currency,
}: {
  detail: InvoiceDetail
  currency: string | null
}) {
  const c = detail.customer
  const s = detail.summary
  const p = detail.payment
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <DetailSection title="Invoice overview" icon={FileTextIcon}>
          <FieldGrid>
            <Field label="Invoice number">
              {copyable(detail.number, 'Copy invoice number')}
            </Field>
            <Field label="Invoice type">
              {detail.kindLabel || (detail.kind ? kindLabel(detail.kind) : '')}
            </Field>
            <Field label="Invoice date">
              {detail.date ? dateOrTime(detail.date) : ''}
            </Field>
            <Field label="Created at">
              {detail.createdAt ? dateOrTime(detail.createdAt) : ''}
            </Field>
            <Field label="Currency">{detail.currency}</Field>
            <Field label="Status">
              {detail.posted !== null ? (
                <FlagBadge
                  value={detail.posted}
                  yes="Posted"
                  no="Not Posted"
                  yesTone="success"
                  noTone="neutral"
                />
              ) : (
                detail.postedText
              )}
            </Field>
            <Field label="Printed status">{detail.printed}</Field>
            <Field label="Customer order number">
              {copyable(detail.customerOrderNumber, 'Copy customer order number')}
            </Field>
            <Field label="Taken by">{detail.takenBy}</Field>
            <Field label="From sales order">{detail.fromSalesOrder}</Field>
            <Field label="Quote status">{detail.quoteStatus}</Field>
            <Field label="Quote expiry date">
              {detail.quoteExpiry ? dateOrTime(detail.quoteExpiry) : ''}
            </Field>
          </FieldGrid>
        </DetailSection>

        <DetailSection title="Customer information" icon={UsersIcon}>
          <FieldGrid>
            <Field label="Customer name">
              {c.accountRef && c.name ? (
                <Link
                  to={customerPath(c.accountRef)}
                  state={{ linkedName: c.name }}
                  className="text-text hover:text-accent font-semibold no-underline hover:underline"
                >
                  {c.name}
                </Link>
              ) : (
                c.name
              )}
            </Field>
            <Field label="Account reference">
              {copyable(c.accountRef, 'Copy account reference')}
            </Field>
            <Field label="Contact name">{c.contactName}</Field>
            <Field label="Telephone">{c.telephone}</Field>
            <Field label="Secondary telephone">{c.telephone2}</Field>
            <Field label="Email">
              {c.email ? (
                <a
                  href={`mailto:${c.email}`}
                  className="text-accent break-all no-underline hover:underline"
                >
                  {c.email}
                </a>
              ) : null}
            </Field>
            <Field label="VAT registration number">{c.vatNumber}</Field>
            <Field label="Country code">{c.countryCode}</Field>
            <Field label="Credit limit">
              {c.creditLimit === null ? '' : money(c.creditLimit, currency)}
            </Field>
            <Field label="Account balance">
              {c.balance === null ? '' : money(c.balance, currency)}
            </Field>
            <Field label="On hold">
              <FlagBadge
                value={c.onHold}
                yes="On hold"
                no="Not on hold"
                yesTone="danger"
              />
            </Field>
            <Field label="Payment due days">{c.paymentDueDays}</Field>
            <Field label="CRM customer ID">
              {copyable(c.crmCustomerId, 'Copy CRM customer ID')}
            </Field>
          </FieldGrid>
        </DetailSection>

        <div className="grid gap-4 xl:grid-cols-2">
          <DetailSection title="Invoice address" icon={UsersIcon}>
            <AddressBlock
              address={detail.invoiceAddress}
              emptyText="No invoice address."
            />
          </DetailSection>
          <DetailSection title="Delivery address" icon={UsersIcon}>
            <AddressBlock
              address={detail.deliveryAddress}
              emptyText="No delivery address."
            />
          </DetailSection>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <DetailSection title="Amount summary" icon={PoundIcon}>
          <dl className="m-0">
            <Row label="Items net">{money(s.itemsNet, currency)}</Row>
            <Row label="Items tax">{money(s.itemsTax, currency)}</Row>
            <Row label="Discount net">{money(s.discountNet, currency)}</Row>
            <Row label="Discount description">{s.discountDescription || '—'}</Row>
            <Row label="Carriage net">{money(s.carriageNet, currency)}</Row>
            <Row label="Carriage tax">{money(s.carriageTax, currency)}</Row>
            <Row label="Carriage gross">{money(s.carriageGross, currency)}</Row>
            <Row label="Total net" strong>
              {money(s.totalNet, currency)}
            </Row>
            <Row label="Total tax" strong>
              {money(s.totalTax, currency)}
            </Row>
            <Row label="Total gross" strong>
              {money(s.totalGross, currency)}
            </Row>
            <Row label="Amount prepaid">{money(s.prepaid, currency)}</Row>
          </dl>
        </DetailSection>

        <DetailSection title="VAT analysis" icon={PoundIcon}>
          {detail.vat.length === 0 ? (
            <p className="text-text-muted m-0 text-[0.85rem]">No VAT analysis.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={DETAIL_TH}>VAT rate</th>
                    <th className={NUMBER_TH}>Net amount</th>
                    <th className={NUMBER_TH}>Tax amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.vat.map((row, index) => (
                    <tr
                      key={`${row.rate}-${index}`}
                      className="border-border border-b last:border-b-0"
                    >
                      <td className={`${DETAIL_TD} font-medium`}>{row.rate || '—'}</td>
                      <td className={NUMBER_TD}>{money(row.net, currency)}</td>
                      <td className={NUMBER_TD}>{money(row.tax, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DetailSection>

        <DetailSection title="Payment information" icon={CreditCardIcon}>
          <dl className="m-0">
            <Row label="Payment status">
              {p.status ? (
                <Badge tone={paymentTone(p.status)}>{paymentLabel(p.status)}</Badge>
              ) : (
                '—'
              )}
            </Row>
            <Row label="Paid amount">{money(p.paid, currency)}</Row>
            <Row label="Outstanding amount">{money(p.outstanding, currency)}</Row>
            <Row label="Due date">{p.dueDate ? dateOrTime(p.dueDate) : '—'}</Row>
            <Row label="Overdue status">
              {p.overdue === null ? (
                '—'
              ) : (
                <FlagBadge
                  value={p.overdue}
                  yes="Overdue"
                  no="Not overdue"
                  yesTone="danger"
                />
              )}
            </Row>
            <Row label="Days overdue">{quantity(p.daysOverdue)}</Row>
            <Row label="Ledger transaction">{p.ledgerTransaction || '—'}</Row>
          </dl>
        </DetailSection>
      </div>
    </div>
  )
}

function Additional({
  detail,
  currency,
}: {
  detail: InvoiceDetail
  currency: string | null
}) {
  const a = detail.additional
  return (
    <div className="flex flex-col gap-4">
      <DetailSection title="Additional information" icon={FileTextIcon}>
        <FieldGrid>
          <Field label="Courier">{a.courier}</Field>
          <Field label="Consignment">{copyable(a.consignment, 'Copy consignment')}</Field>
          <Field label="Settlement due days">{a.settlementDueDays}</Field>
          <Field label="Settlement discount rate">{a.settlementDiscountRate}</Field>
        </FieldGrid>
        <div className="mt-5">
          <p className="text-text-muted mb-1 text-[0.68rem] font-bold tracking-wide uppercase">
            Invoice notes
          </p>
          {a.notes ? (
            <p
              className={`m-0 font-medium break-words whitespace-pre-wrap ${SMALL_TEXT}`}
            >
              {a.notes}
            </p>
          ) : (
            <p className="text-text-muted m-0 text-[0.85rem]">No notes.</p>
          )}
        </div>
      </DetailSection>

      {detail.salesOrder && detail.salesOrder.length > 0 && (
        <DetailSection title="Sales order details" icon={ProductsIcon}>
          <FieldGrid>
            {detail.salesOrder.map(([label, value]) => (
              <Field key={label} label={label}>
                {looseValue(label.toLowerCase(), value, currency)}
              </Field>
            ))}
          </FieldGrid>
        </DetailSection>
      )}

      {detail.moreFields.length > 0 && (
        <DetailSection title="More details" icon={GridIcon} defaultOpen={false}>
          <FieldGrid>
            {detail.moreFields.map(([label, value]) => (
              <Field key={label} label={label}>
                {looseValue(label.toLowerCase(), value, currency)}
              </Field>
            ))}
          </FieldGrid>
        </DetailSection>
      )}
    </div>
  )
}
