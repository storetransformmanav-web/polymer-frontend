import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailEmpty } from '../../../components/ui/DetailSection.tsx'
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  GlobeIcon,
  GridIcon,
  ListChecksIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  PoundIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type { SageAddress, SageCustomerDetail } from '../../../lib/api/sageCustomers.ts'
import { count, humanize, money, yesNo } from '../utils/format.ts'
import { crmCustomerPath } from '../utils/paths.ts'
import { CardBadge, CardShell, FigureCard, Row, RowList } from './SageCards.tsx'
import {
  RecentInvoicesTable,
  RecentOrdersTable,
  ContactHistoryTable,
  StatementTable,
} from './SageCustomerTables.tsx'

interface PanelProps {
  detail: SageCustomerDetail
  currency: string | null
}

const copyable = (value: string, label: string) =>
  value ? (
    <span className="flex items-center gap-1.5">
      <span className="break-all">{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  ) : null

/** A link to a mail program, only for something that is one plain address. */
const mailHref = (email: string) =>
  /^[^\s@<>]+@[^\s@<>]+$/.test(email) ? `mailto:${email}` : null

function EmailLink({ email }: { email: string }) {
  const href = mailHref(email)
  return href ? (
    <a href={href} className="text-accent break-all hover:underline">
      {email}
    </a>
  ) : (
    <span className="break-all">{email}</span>
  )
}

/** An address as the API formats it, one line each. */
function AddressBlock({
  address,
  emptyText,
  compact = false,
}: {
  address: SageAddress | null
  emptyText: string
  /** Smaller type (the addresses tab). */
  compact?: boolean
}) {
  if (!address) return <p className="text-text-muted m-0 text-[0.85rem]">{emptyText}</p>
  const [first, ...rest] = address.lines
  return (
    <address
      className={`m-0 leading-snug not-italic ${compact ? 'text-[0.76rem]' : 'text-[0.88rem] leading-relaxed'}`}
    >
      <span className="block font-semibold break-words">{first}</span>
      {rest.map((line, index) => (
        <span key={`${line}-${index}`} className="block break-words">
          {line}
        </span>
      ))}
    </address>
  )
}

/** An icon tile and the content beside it: one line of a contact card. */
function ContactLine({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MailIcon
  label?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="bg-accent-tint text-accent flex size-9 shrink-0 items-center justify-center rounded-lg"
      >
        <Icon width={17} height={17} />
      </span>
      <div className="min-w-0 text-[0.88rem]">
        {label && <p className="text-text-muted m-0 text-[0.7rem]">{label}</p>}
        <div className="font-medium break-words">{children}</div>
      </div>
    </div>
  )
}

const isDelivery = (kind: string) => kind.toLowerCase() === 'delivery'

/**
 * **Overview** (after the shared reference design): four figures — the balance, the invoices, the
 * orders and the transactions —, then **Company Information** and **CRM / Shopify Link** on the left;
 * on the right the **Primary Contact**, the **Invoice Address** beside the **Delivery Addresses** (the
 * first four, with View All → the Addresses tab) and the **Key Details** (VAT, company, EORI and DUNS
 * numbers). Every value is the backend's; an empty one is a dash.
 */
export function OverviewPanel({
  detail,
  currency,
  onTab,
}: PanelProps & { onTab: (id: string) => void }) {
  const contact = detail.contact
  const crm = detail.crm_customer
  const delivery = (detail.addresses ?? []).filter((entry) => isDelivery(entry.kind))
  const email = contact?.emails[0] ?? ''

  // An address as one comparable text ("Name <a@b.com>" → "a@b.com"), so an email already shown
  // is not shown again under another label.
  const bare = (value: string) =>
    (/<([^>]+)>/.exec(value)?.[1] ?? value).trim().toLowerCase()
  const shown = new Set((contact?.emails ?? []).map(bare))
  const directDebits = contact?.direct_debits_email ?? ''
  const showDirectDebits = directDebits !== '' && !shown.has(bare(directDebits))
  const showCrmEmail = !!crm?.email && !shown.has(bare(crm.email))

  return (
    <>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <CardShell title="Primary Contact" icon={UsersIcon}>
          <p className="m-0 mb-3 text-[1.05rem] font-bold break-words uppercase">
            {contact?.contact_name || (
              <span className="text-text-muted normal-case">—</span>
            )}
          </p>
          <div className="grid gap-3 min-[640px]:grid-cols-2 2xl:grid-cols-3">
            <ContactLine icon={MailIcon}>
              {email ? <EmailLink email={email} /> : '—'}
            </ContactLine>
            <ContactLine icon={PhoneIcon}>{contact?.telephone || '—'}</ContactLine>
            <ContactLine icon={PhoneIcon}>{contact?.telephone_2 || '—'}</ContactLine>
          </div>
          <div className="border-border mt-4 grid gap-3 border-t pt-4 min-[640px]:grid-cols-2">
            {showDirectDebits && (
              <ContactLine icon={MailIcon} label="Direct Debits Email">
                {directDebits}
              </ContactLine>
            )}
            <ContactLine icon={CheckCircleIcon} label="Letters Via Email">
              {yesNo(contact?.letters_via_email)}
            </ContactLine>
          </div>
        </CardShell>

        <CardShell title="CRM / Shopify Link" icon={UsersIcon}>
          <RowList>
            <Row label="Shopify Customer ID">
              {copyable(detail.shopify_customer_id, 'Copy Shopify customer ID')}
            </Row>
            <Row label="CRM Customer ID">
              {crm ? (
                <span className="flex items-center gap-1.5">
                  <Link
                    to={crmCustomerPath(crm.id)}
                    state={{ linkedName: crm.name }}
                    className="text-text hover:text-accent break-all no-underline hover:underline"
                    title="Open the CRM customer"
                  >
                    {crm.id}
                  </Link>
                  <CopyButton value={crm.id} label="Copy CRM customer ID" />
                </span>
              ) : null}
            </Row>
            {showCrmEmail && crm && (
              <Row label="CRM Email">
                <EmailLink email={crm.email} />
              </Row>
            )}
            <Row label="Orders Count">{crm ? count(crm.orders_count) : null}</Row>
            <Row label="Total Spent">{crm ? money(crm.total_spent, currency) : null}</Row>
          </RowList>
        </CardShell>
      </div>

      <div className="grid items-start gap-4 min-[900px]:grid-cols-2">
        <CardShell title="Invoice Address" icon={FileTextIcon}>
          <AddressBlock
            address={detail.invoice_address}
            emptyText="No invoice address."
          />
        </CardShell>
        <CardShell
          title={`Delivery Addresses (${delivery.length})`}
          icon={MapPinIcon}
          action={
            delivery.length > 0 ? (
              <button
                type="button"
                onClick={() => onTab('addresses')}
                className="text-accent inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[0.8rem] font-semibold hover:underline"
              >
                View All
                <ChevronRightIcon width={14} height={14} />
              </button>
            ) : undefined
          }
        >
          {delivery.length > 0 ? (
            <ul className="m-0 flex list-none flex-col p-0">
              {delivery.slice(0, 4).map((entry, index) => (
                <li
                  key={`${entry.reference}-${index}`}
                  className="border-border flex items-center gap-3 border-b py-2 text-[0.85rem] last:border-b-0"
                >
                  <TruckIcon
                    width={16}
                    height={16}
                    className="text-accent shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {entry.description || entry.address?.lines[0] || entry.reference}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <AddressBlock
              address={detail.default_delivery_address}
              emptyText="No delivery addresses."
            />
          )}
        </CardShell>
      </div>
    </>
  )
}

type AddressFilter = 'all' | 'invoice' | 'delivery' | 'other'

type AddressEntry = NonNullable<SageCustomerDetail['addresses']>[number]

/** One address card's facts at its right: tax code, country and VAT number, then any contact details. */
function AddressFacts({
  taxCode,
  country,
  vat,
  extras = [],
}: {
  taxCode: string
  country: string
  vat: string
  extras?: [string, ReactNode][]
}) {
  const facts: [typeof FileTextIcon, string, ReactNode][] = [
    [FileTextIcon, 'Tax Code', taxCode],
    [GlobeIcon, 'Country', country],
    [ListChecksIcon, 'VAT Reg. No.', vat],
    ...extras.map(([label, value]): [typeof FileTextIcon, string, ReactNode] => [
      FileTextIcon,
      label,
      value,
    ]),
  ]
  return (
    <ul className="m-0 flex min-w-0 list-none flex-col gap-1 p-0 text-[0.72rem]">
      {facts.map(([Icon, label, value]) => (
        <li key={label} className="flex min-w-0 items-start gap-2">
          <Icon
            width={13}
            height={13}
            className="text-accent mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span className="text-text-muted shrink-0">{label}:</span>
          <span className="min-w-0 font-semibold break-words">
            {value || <span className="text-text-muted font-normal">—</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** The address (a pin and its lines) on the left, a rule, and its facts on the right. */
function AddressBody({
  address,
  emptyText,
  children,
}: {
  address: SageAddress | null
  emptyText: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2 min-[560px]:grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)] min-[560px]:gap-0">
      <div className="flex min-w-0 gap-1.5 min-[560px]:pr-3">
        <MapPinIcon
          width={14}
          height={14}
          className="text-accent mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <AddressBlock address={address} emptyText={emptyText} compact />
      </div>
      <div className="border-border min-[560px]:border-l min-[560px]:pl-3">
        {children}
      </div>
    </div>
  )
}

/** One numbered address card: "#2 NAME", its type as a pill, then the address and its facts. */
function NumberedAddress({
  number,
  title,
  badge,
  address,
  children,
}: {
  number: number
  title: string
  badge: string
  address: SageAddress | null
  children: ReactNode
}) {
  return (
    <section className="border-border-strong bg-bg flex min-w-0 flex-col overflow-hidden rounded-xl border">
      <header className="border-border flex items-center gap-2 border-b px-2.5 py-1">
        <span className="bg-accent-tint text-accent rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold">
          #{number}
        </span>
        <h4 className="m-0 min-w-0 flex-1 truncate text-[0.76rem] font-semibold uppercase">
          {title}
        </h4>
        {badge && (
          <span className="bg-accent-tint text-accent shrink-0 rounded-full px-2 py-0.5 text-[0.66rem] font-semibold">
            {badge}
          </span>
        )}
      </header>
      <div className="p-2.5">
        <AddressBody address={address} emptyText="No address lines.">
          {children}
        </AddressBody>
      </div>
    </section>
  )
}

/**
 * **Addresses** (after the shared reference design): a small menu on the left — **All
 * Addresses**, **Invoice Address**, **Delivery Addresses** (and **Other Addresses** when the account
 * has any), each with its count — that narrows what is shown on the right: the **Invoice Address** card
 * and the **Delivery Addresses** as numbered cards, each with its type, the address lines and its tax
 * code, country and VAT number. The invoice address's facts are the company's. Every value is the
 * backend's; an empty one is a dash.
 */
export function AddressesPanel({ detail }: PanelProps) {
  const [filter, setFilter] = useState<AddressFilter>('all')
  const entries = detail.addresses ?? []
  const delivery = entries.filter((entry) => isDelivery(entry.kind))
  const other = entries.filter((entry) => !isDelivery(entry.kind))
  const invoice = detail.invoice_address
  const company = detail.company
  const defaultTaxCode = detail.credit?.default_tax_code ?? ''

  // The default delivery address, when none of the listed ones is the same address.
  const defaultAddress = detail.default_delivery_address
  const key = (address: SageAddress | null) =>
    address?.lines.join('|').toLowerCase() ?? ''
  const showDefault =
    !!defaultAddress &&
    !entries.some((entry) => key(entry.address) === key(defaultAddress))

  const deliveryCount = delivery.length + (showDefault ? 1 : 0)
  const total = (invoice ? 1 : 0) + deliveryCount + other.length

  const menu: [AddressFilter, string, number, typeof FileTextIcon][] = [
    ['all', 'All Addresses', total, GridIcon],
    ['invoice', 'Invoice Address', invoice ? 1 : 0, FileTextIcon],
    ['delivery', 'Delivery Addresses', deliveryCount, TruckIcon],
  ]
  if (other.length > 0) menu.push(['other', 'Other Addresses', other.length, MapPinIcon])

  const show = (kind: AddressFilter) => filter === 'all' || filter === kind

  // The invoice address is #1; the others follow in the order they are listed.
  let counter = invoice ? 1 : 0
  const defaultNumber = showDefault ? ++counter : 0
  const deliveryCards = delivery.map((entry) => ({ entry, number: ++counter }))
  const otherCards = other.map((entry) => ({ entry, number: ++counter }))

  const entryCard = (
    { entry, number }: { entry: AddressEntry; number: number },
    index: number,
  ) => {
    const extras: [string, ReactNode][] = [
      ['Reference', entry.reference],
      ['Contact', entry.contact_name],
      ['Telephone', entry.telephone],
      ['Telephone 2', entry.telephone_2],
      ['Email', entry.email ? <EmailLink key="email" email={entry.email} /> : null],
      ['Notes', entry.notes],
    ]
    return (
      <NumberedAddress
        key={`${entry.reference}-${index}`}
        number={number}
        title={
          entry.description || entry.address?.lines[0] || entry.reference || 'Address'
        }
        badge={entry.kind_label || humanize(entry.kind)}
        address={entry.address}
      >
        <AddressFacts
          taxCode={entry.tax_code}
          country={entry.country_code}
          vat={entry.vat_reg_number}
          extras={extras.filter(([, value]) => !!value)}
        />
      </NumberedAddress>
    )
  }

  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="grid items-start gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <nav
          aria-label="Address types"
          className="border-border-strong bg-bg flex flex-row gap-0.5 overflow-x-auto rounded-xl border p-1.5 lg:flex-col lg:self-start lg:overflow-visible"
        >
          {menu.map(([id, label, amount, Icon]) => {
            const selected = filter === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(id)}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[0.76rem] font-semibold transition-colors ${
                  selected
                    ? 'border-accent bg-accent-tint text-accent'
                    : 'text-text hover:bg-accent-tint/50 border-transparent bg-transparent'
                }`}
              >
                <Icon width={14} height={14} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 whitespace-nowrap">{label}</span>
                <span className="tabular-nums">{amount}</span>
              </button>
            )
          })}
        </nav>

        <div className="@container flex min-w-0 flex-col gap-2 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1 [&>*]:shrink-0">
          {total === 0 && (
            <DetailEmpty icon={MapPinIcon}>This account has no addresses.</DetailEmpty>
          )}

          {invoice && show('invoice') && (
            <CardShell title="Invoice Address" icon={FileTextIcon} compact>
              <AddressBody address={invoice} emptyText="No invoice address.">
                <AddressFacts
                  taxCode={defaultTaxCode}
                  country={company?.country_code ?? ''}
                  vat={company?.vat_reg_number ?? ''}
                />
              </AddressBody>
            </CardShell>
          )}

          {deliveryCount > 0 && show('delivery') && (
            <CardShell
              title={`Delivery Addresses (${deliveryCount})`}
              icon={TruckIcon}
              compact
            >
              <div className="grid gap-2 @[40rem]:grid-cols-2 @[66rem]:grid-cols-3">
                {showDefault && (
                  <NumberedAddress
                    number={defaultNumber}
                    title={defaultAddress?.lines[0] ?? ''}
                    badge="Default"
                    address={defaultAddress}
                  >
                    <AddressFacts
                      taxCode={defaultTaxCode}
                      country={company?.country_code ?? ''}
                      vat={company?.vat_reg_number ?? ''}
                    />
                  </NumberedAddress>
                )}
                {deliveryCards.map(entryCard)}
              </div>
            </CardShell>
          )}

          {other.length > 0 && show('other') && (
            <CardShell
              title={`Other Addresses (${other.length})`}
              icon={MapPinIcon}
              compact
            >
              <div className="grid gap-2 @[40rem]:grid-cols-2 @[66rem]:grid-cols-3">
                {otherCards.map(entryCard)}
              </div>
            </CardShell>
          )}
        </div>
      </div>
    </div>
  )
}

/** The aged-debt buckets drawn in the ring and its legend, in order, with the colour of each. */
const AGED_SEGMENTS = [
  { key: 'current', label: 'Current', color: 'var(--color-accent)' },
  { key: 'days_30', label: '30 Days', color: 'var(--color-border-strong)' },
  { key: 'days_60', label: '60 Days', color: 'var(--color-warning)' },
  { key: 'days_90', label: '90 Days', color: 'var(--color-danger)' },
  { key: 'older', label: 'Older', color: 'var(--color-text)' },
] as const

/**
 * A ring of the aged debt: each bucket's share of what is outstanding, with the total in the middle
 * and a legend (colour, bucket, amount and share) beside it. The shares are worked out from the
 * backend's amounts (credits are not drawn); with nothing outstanding the ring is an empty grey one.
 */
function AgedDebtChart({
  aged,
  currency,
}: {
  aged: NonNullable<SageCustomerDetail['aged_debt']>
  currency: string | null
}) {
  const parts = AGED_SEGMENTS.map((segment) => ({
    ...segment,
    amount: aged[segment.key] ?? 0,
  }))
  const sum = parts.reduce((total, part) => total + Math.max(0, part.amount), 0)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const shares = parts.map((part) => (sum > 0 ? Math.max(0, part.amount) / sum : 0))
  const arcs = parts.map((part, index) => {
    const share = shares[index]
    const before = shares.slice(0, index).reduce((total, value) => total + value, 0)
    return { ...part, share, dash: share * circumference, offset: before * circumference }
  })

  return (
    <div className="flex min-w-0 flex-col items-center gap-3">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="11"
            style={{ stroke: 'var(--color-border)' }}
          />
          {arcs
            .filter((arc) => arc.share > 0)
            .map((arc) => (
              <circle
                key={arc.key}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                strokeWidth="11"
                strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
                strokeDashoffset={-arc.offset}
                style={{ stroke: arc.color }}
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[0.95rem] leading-tight font-bold">
            {money(aged.total, currency)}
          </span>
          <span className="text-text-muted text-[0.62rem]">Total Outstanding</span>
        </div>
      </div>
      <ul className="m-0 flex w-full list-none flex-col gap-1 p-0 text-[0.74rem]">
        {arcs.map((arc) => (
          <li key={arc.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: arc.color }}
            />
            <span className="flex-1">{arc.label}</span>
            <span className="tabular-nums">
              {money(arc.amount, currency)} ({Math.round(arc.share * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * **Financials** (after the shared reference design): a heading and four figures — the balance, the
 * credit limit, the available credit and the average days to pay —, then **Credit & Payment Details**
 * and **Tax & Pricing** on the left and **Aged Debt** (the period table with its total, and a ring of
 * the shares) and **Company Registration** on the right, with the open items behind the debt below.
 * Every value is the backend's; an empty one is a dash.
 */
export function FinancialsPanel({ detail, currency }: PanelProps) {
  const credit = detail.credit
  const aged = detail.aged_debt
  const company = detail.company
  const days = credit?.average_pay_days

  return (
    <>
      <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 xl:grid-cols-4">
        <FigureCard
          label="Account Balance"
          value={money(credit?.balance, currency)}
          icon={PoundIcon}
          tone={credit?.over_credit_limit ? 'danger' : 'accent'}
        />
        <FigureCard
          label="Credit Limit"
          value={money(credit?.credit_limit, currency)}
          icon={CreditCardIcon}
          tone="neutral"
        />
        <FigureCard
          label="Available Credit"
          value={money(credit?.available_credit, currency)}
          icon={PoundIcon}
          tone={(credit?.available_credit ?? 0) < 0 ? 'danger' : 'good'}
        />
        <FigureCard
          label="Average Payment"
          value={days === null || days === undefined ? '—' : `${count(days)} Days`}
          icon={CalendarIcon}
          tone="warning"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <CardShell title="Credit & Payment Details" icon={CreditCardIcon}>
            <RowList>
              <Row label="Payment Terms Agreed">
                {credit?.terms_agreed === null ||
                credit?.terms_agreed === undefined ? null : (
                  <span className="inline-flex items-center gap-1.5">
                    {credit.terms_agreed && (
                      <CheckCircleIcon
                        width={16}
                        height={16}
                        className="text-accent"
                        aria-hidden="true"
                      />
                    )}
                    {yesNo(credit.terms_agreed)}
                  </span>
                )}
              </Row>
              <Row label="Payment Terms (Days)">{count(credit?.payment_due_days)}</Row>
              <Row label="Settlement Discount">{credit?.settlement_discount_rate}</Row>
              <Row label="Interest Charging">{yesNo(credit?.can_charge_interest)}</Row>
              <Row label="Over Credit Limit">{yesNo(credit?.over_credit_limit)}</Row>
              <Row label="Mail Restriction">{yesNo(credit?.restrict_mail)}</Row>
            </RowList>
          </CardShell>

          <CardShell title="Tax & Pricing" icon={TagIcon}>
            <RowList>
              <Row label="Default Tax Code">{credit?.default_tax_code}</Row>
              <Row label="Price Reference">{credit?.pricing_ref}</Row>
              <Row label="Price List">{credit?.price_list_name}</Row>
              <Row label="Country">{company?.country_code}</Row>
              <Row label="Currency">{company?.currency}</Row>
            </RowList>
          </CardShell>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <CardShell title="Aged Debt" icon={ClockIcon}>
            <div className="grid gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,13rem)] min-[900px]:gap-0">
              <div className="min-w-0 min-[900px]:pr-5">
                <table className="w-full border-collapse text-[0.85rem]">
                  <thead>
                    <tr className="bg-table-head text-text text-[0.7rem] tracking-wide uppercase">
                      <th className="px-3 py-2 text-left font-bold">Period</th>
                      <th className="px-3 py-2 text-right font-bold">
                        Amount{currency ? ` (${currency})` : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['Future', aged?.future],
                        ['Current', aged?.current],
                        ['30 Days', aged?.days_30],
                        ['60 Days', aged?.days_60],
                        ['90 Days', aged?.days_90],
                        ['Older', aged?.older],
                      ] as [string, number | null | undefined][]
                    ).map(([label, value]) => (
                      <tr key={label} className="border-border border-b">
                        <td className="px-3 py-2">{label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {money(value, currency)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-accent-tint font-bold">
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(aged?.total, currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="border-border min-[900px]:border-l min-[900px]:pl-5">
                {aged && <AgedDebtChart aged={aged} currency={currency} />}
              </div>
            </div>
          </CardShell>

          <CardShell title="Company Registration" icon={StoreIcon}>
            <RowList>
              <Row label="VAT Registration No.">{company?.vat_reg_number}</Row>
              <Row label="Company Registration No.">
                {company?.company_registration_number}
              </Row>
              <Row label="EORI Number">{company?.eori_number}</Row>
              <Row label="DUNS Number">{company?.duns_number}</Row>
            </RowList>
          </CardShell>
        </div>
      </div>
    </>
  )
}

/** **Orders**: the newest sales orders and the newest invoices. */
export function OrdersPanel({ detail, currency }: PanelProps) {
  return (
    <>
      <CardShell
        title="Recent Sales Orders"
        icon={ShoppingCartIcon}
        badge={<CardBadge>{detail.recent_orders?.length ?? 0}</CardBadge>}
        flush
      >
        <RecentOrdersTable items={detail.recent_orders} currency={currency} />
      </CardShell>
      <CardShell
        title="Recent Invoices"
        icon={FileTextIcon}
        badge={<CardBadge>{detail.recent_invoices?.length ?? 0}</CardBadge>}
        flush
      >
        <RecentInvoicesTable items={detail.recent_invoices} currency={currency} />
      </CardShell>
    </>
  )
}

/**
 * **Transactions**: the open items on the account — what is still to be paid — exactly as the
 * customer's details answer carries them (no other request).
 */
export function TransactionsPanel({ detail, currency }: PanelProps) {
  return (
    <>
      <section
        aria-label="Transactions"
        className="border-border-strong bg-bg overflow-hidden rounded-xl border"
      >
        <div className="overflow-x-auto">
          <StatementTable
            items={detail.open_items ?? []}
            currency={currency}
            emptyText="Nothing is outstanding on this account."
          />
        </div>
      </section>
    </>
  )
}

/**
 * **Contact History**: the newest calls, letters, emails and meetings logged against the account in
 * Sage, as the customer's details answer carries them (no other request).
 */
export function ContactHistoryPanel({ detail, currency }: PanelProps) {
  return (
    <>
      <section
        aria-label="Contact history"
        className="border-border-strong bg-bg overflow-hidden rounded-xl border"
      >
        <div className="overflow-x-auto">
          <ContactHistoryTable
            items={detail.contact_history ?? []}
            currency={currency}
            emptyText="Nothing has been logged against this account yet."
          />
        </div>
      </section>
    </>
  )
}
