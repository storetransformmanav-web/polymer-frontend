import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
  LayersIcon,
  MapPinIcon,
  PoundIcon,
  ProductsIcon,
  TruckIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type {
  InvoiceAddress,
  InvoiceDetail,
  InvoiceLine,
} from '../../../lib/api/invoiceDetail.ts'
import { fieldLabel } from '../../../lib/api/invoiceDetail.ts'
import type { Invoice } from '../../../lib/api/invoices.ts'
import { useInvoiceDetail } from '../hooks/useInvoiceDetail.ts'
import {
  dateOrTime,
  dateTimeAmPm,
  kindLabel,
  looseValue,
  money,
  paymentLabel,
  paymentTone,
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

const copyable = (value: string, label: string) =>
  value ? (
    <span className="flex items-center gap-1.5">
      <span className="break-all">{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  ) : null

/** An address as the API formats it, one line each; its plain fields only when there are no lines. */
function AddressBlock({
  address,
  emptyText,
}: {
  address: InvoiceAddress | null
  emptyText: string
}) {
  if (!address || (address.lines.length === 0 && address.fields.length === 0)) {
    return <p className="text-text-muted m-0 text-[0.85rem]">{emptyText}</p>
  }
  if (address.lines.length > 0) {
    // The name on its own line, then the rest of the address on one line:
    //   BLUE NILE BAKERY LIMITED
    //   268 HARROW ROAD, LONDON, W2 5ES
    const [name, ...rest] = address.lines
    const street = rest.join(', ')
    return (
      <address className="m-0 text-[0.92rem] leading-relaxed font-semibold not-italic">
        <span className="block break-words">{name}</span>
        {street && <span className="block break-words">{street}</span>}
      </address>
    )
  }
  return (
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
  )
}

const NUMBER_TD = `${DETAIL_TD} text-right tabular-nums`
const NUMBER_TH = `${DETAIL_TH} text-right`

/** The invoice's products, in a table that scrolls sideways when the window is narrower than it. */
function ItemsTable({
  lines,
  currency,
}: {
  lines: InvoiceLine[]
  currency: string | null
}) {
  if (lines.length === 0) {
    return <DetailEmpty icon={ProductsIcon}>This invoice has no items.</DetailEmpty>
  }
  return (
    <div className={`${DETAIL_CARD} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${DETAIL_TH} w-20 text-center`}>Position</th>
              <th className={`${DETAIL_TH} w-32`}>Stock code</th>
              <th className={DETAIL_TH}>Product title</th>
              <th className={`${DETAIL_TH} w-28`}>Unit of sale</th>
              <th className={`${NUMBER_TH} w-24`}>Quantity</th>
              <th className={`${NUMBER_TH} w-28`}>Unit price</th>
              <th className={`${NUMBER_TH} w-28`}>Net</th>
              <th className={`${NUMBER_TH} w-28`}>Gross</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const title = line.crmProduct?.title || line.description
              return (
                <tr
                  key={`${line.position}-${index}`}
                  className="border-border even:bg-surface/60 border-b align-top last:border-b-0"
                >
                  <td className={`${DETAIL_TD} text-text-muted text-center`}>
                    {line.position || '—'}
                  </td>
                  {line.isTextLine ? (
                    <td
                      colSpan={7}
                      className={`${DETAIL_TD} text-text-muted !whitespace-normal italic`}
                    >
                      {[line.description, line.extraText].filter(Boolean).join(' — ') ||
                        '—'}
                    </td>
                  ) : (
                    <>
                      <td
                        className={`${DETAIL_TD} truncate font-medium`}
                        title={line.stockCode}
                      >
                        {line.stockCode || '—'}
                      </td>
                      <td className={`${DETAIL_TD} !whitespace-normal`}>
                        {line.crmProduct?.id ? (
                          <Link
                            to={`/products/${encodeURIComponent(line.crmProduct.id)}`}
                            className="text-text hover:text-accent font-medium break-words no-underline hover:underline"
                          >
                            {title || '—'}
                          </Link>
                        ) : (
                          <span className="font-medium break-words">{title || '—'}</span>
                        )}
                      </td>
                      <td className={DETAIL_TD}>{line.unitOfSale || '—'}</td>
                      <td className={NUMBER_TD}>{quantity(line.quantity)}</td>
                      <td className={NUMBER_TD}>{money(line.unitPrice, currency)}</td>
                      <td className={NUMBER_TD}>{money(line.net, currency)}</td>
                      <td className={`${NUMBER_TD} font-semibold`}>
                        {money(line.gross, currency)}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
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
 * the invoice number, its payment status as a badge, the amount paid, the dates and the customer as
 * chips, **Back to list**), a tab strip and clearly labelled cards. The invoice is **asked for by its
 * number when the page opens** (`GET /api/sage/invoices/{invoice_number}`) and the answer is the
 * source of truth; while it loads the header draws from the list row. Tabs: **Overview** (invoice
 * overview, customer information, the addresses and the VAT analysis), **Items** (the products and,
 * under them, the amount summary), **Payments** (the allocations) and **Additional information**
 * (notes, courier, consignment, settlement terms, the sales order, and any other field the API
 * sent). Each fact is shown once; empty values show a dash, never a broken layout.
 */
export function InvoiceDetailsView({
  reference,
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
  const shownNumber = detail?.number || preview?.number || reference
  const paymentStatus = detail?.payment.status || preview?.paymentStatus || ''
  const paid = detail?.payment.paid ?? preview?.paid ?? null
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
    title: `Invoice ${shownNumber}`,
    status: (
      <>
        {paymentStatus && (
          <StatusPill
            label={paymentLabel(paymentStatus)}
            tone={paymentTone(paymentStatus)}
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
        {paid !== null && (
          <HeaderChip icon={PoundIcon} label="Paid">
            <span aria-hidden="true" className="text-text-muted">
              Paid:
            </span>{' '}
            <span className="font-semibold">{money(paid, currency)}</span>
          </HeaderChip>
        )}
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
        { id: 'items', label: 'Items', icon: ProductsIcon, count: detail.lines.length },
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
      {tab === 'overview' && <Overview detail={detail} />}
      {tab === 'items' && <Items detail={detail} currency={currency} />}
      {tab === 'payments' && (
        <PaymentsTable payments={detail.payments} currency={currency} />
      )}
      {tab === 'additional' && <Additional detail={detail} currency={currency} />}
    </DetailPage>
  )
}

/** A column of the overview strip: a thin divider on its left from `lg`, except the first. */
const STRIP_CELL =
  'min-w-0 lg:border-l lg:border-border lg:pl-6 lg:first:border-l-0 lg:first:pl-0'

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

function Overview({ detail }: { detail: InvoiceDetail }) {
  const c = detail.customer
  const currency = detail.currency
  const vatNet = detail.vat.reduce((sum, row) => sum + (row.net ?? 0), 0)
  const vatTax = detail.vat.reduce((sum, row) => sum + (row.tax ?? 0), 0)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DetailSection title="Invoice Overview" icon={FileTextIcon}>
        <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className={STRIP_CELL}>
            <Field label="Invoice number">
              {copyable(detail.number, 'Copy invoice number')}
            </Field>
          </div>
          <div className={STRIP_CELL}>
            <Field label="Invoice type">
              {detail.kindLabel || (detail.kind ? kindLabel(detail.kind) : '')}
            </Field>
          </div>
          <div className={STRIP_CELL}>
            <Field label="Currency">{detail.currency}</Field>
          </div>
          <div className={STRIP_CELL}>
            <Field label="Created at">
              {detail.createdAt ? dateTimeAmPm(detail.createdAt) : ''}
            </Field>
          </div>
        </dl>
      </DetailSection>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DetailSection title="Customer Information" icon={UsersIcon}>
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-5">
              <Field label="Account reference">
                {copyable(c.accountRef, 'Copy account reference')}
              </Field>
              <Field label="Contact name">{c.contactName}</Field>
              <Field label="Telephone">{c.telephone}</Field>
              <Field label="Account balance">
                {c.balance === null ? '' : money(c.balance, currency)}
              </Field>
            </div>
            <div className="border-border flex min-w-0 flex-col gap-5 md:border-l md:pl-6">
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
              <Field label="Email">
                {c.email ? (
                  <a
                    href={`mailto:${c.email}`}
                    className="text-text hover:text-accent break-all no-underline hover:underline"
                  >
                    {c.email}
                  </a>
                ) : null}
              </Field>
              <Field label="Credit limit">
                {c.creditLimit === null ? '' : money(c.creditLimit, currency)}
              </Field>
              <Field label="CRM customer ID">
                {copyable(c.crmCustomerId, 'Copy CRM customer ID')}
              </Field>
            </div>
          </dl>
        </DetailSection>

        <DetailSection title="VAT Analysis" icon={LayersIcon}>
          {detail.vat.length === 0 ? (
            <p className="text-text-muted m-0 text-[0.85rem]">No VAT analysis.</p>
          ) : (
            <dl className="m-0">
              {/* Several rates: each one's own net and tax first, then the totals. */}
              {detail.vat.length > 1 &&
                detail.vat.map((row, index) => (
                  <VatRow
                    key={`${row.rate}-${index}`}
                    label={`${row.rate || 'Rate'} · net / tax`}
                  >
                    {money(row.net, currency)} / {money(row.tax, currency)}
                  </VatRow>
                ))}
              <VatRow label="Net amount">{money(vatNet, currency)}</VatRow>
              <VatRow label="Tax amount">{money(vatTax, currency)}</VatRow>
              <VatRow label="Gross amount">{money(vatNet + vatTax, currency)}</VatRow>
            </dl>
          )}
        </DetailSection>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailSection title="Invoice Address" icon={MapPinIcon}>
          <AddressBlock address={detail.invoiceAddress} emptyText="No invoice address." />
        </DetailSection>
        <DetailSection title="Delivery Address" icon={TruckIcon}>
          <AddressBlock
            address={detail.deliveryAddress}
            emptyText="No delivery address."
          />
        </DetailSection>
      </div>
    </div>
  )
}

/** The products, and under them the amount summary from the answer's `amounts`. */
function Items({ detail, currency }: { detail: InvoiceDetail; currency: string | null }) {
  const s = detail.summary
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ItemsTable lines={detail.lines} currency={currency} />

      <div className="w-full lg:ml-auto lg:max-w-md">
        <DetailSection title="Amount summary" icon={PoundIcon}>
          <dl className="m-0">
            <Row label="Items net">{money(s.itemsNet, currency)}</Row>
            <Row label="Items tax">{money(s.itemsTax, currency)}</Row>
            <Row label="Discount">{money(s.discountNet, currency)}</Row>
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
