import { Link } from 'react-router-dom'
import { Badge, type BadgeTone } from '../../../components/ui/Badge.tsx'
import {
  DETAIL_TD,
  DETAIL_TH,
  DetailEmpty,
  DetailTable,
} from '../../../components/ui/DetailSection.tsx'
import {
  FileTextIcon,
  HistoryIcon,
  OrdersIcon,
  PoundIcon,
} from '../../../components/ui/icons.tsx'
import type {
  SageContactEntry,
  SageCustomerDetail,
  SageTransaction,
} from '../../../lib/api/sageCustomers.ts'
import { dateText, humanize, money, paymentTone } from '../utils/format.ts'
import { invoicePath } from '../utils/paths.ts'

const NUMBER_TH = `${DETAIL_TH} text-right`
const NUMBER_TD = `${DETAIL_TD} text-right tabular-nums`
const ROW = 'border-border even:bg-surface/60 border-b align-top last:border-b-0'

/** A long text cut to one line, the whole of it on hover. */
function Clip({ value }: { value: string }) {
  if (!value) return <span className="text-text-muted">—</span>
  return (
    <span className="block truncate" title={value}>
      {value}
    </span>
  )
}

/**
 * The contact history: calls, letters, emails, statements and meetings logged against the account,
 * newest first — when, what kind and how it ended, the subject and notes, who was spoken to and by
 * whom, how long it took, and any promised payment and follow-up date.
 */
export function ContactHistoryTable({
  items,
  currency,
  emptyText,
  stale = false,
}: {
  items: readonly SageContactEntry[]
  currency: string | null
  emptyText: string
  stale?: boolean
}) {
  if (items.length === 0) {
    return <DetailEmpty icon={HistoryIcon}>{emptyText}</DetailEmpty>
  }
  return (
    <DetailTable>
      <thead>
        <tr>
          <th className={`${DETAIL_TH} w-28`}>Date</th>
          <th className={`${DETAIL_TH} w-32`}>Type</th>
          <th className={`${DETAIL_TH} w-32`}>Outcome</th>
          <th className={`${DETAIL_TH} w-48`}>Subject</th>
          <th className={DETAIL_TH}>Notes</th>
          <th className={`${DETAIL_TH} w-36`}>Contact</th>
          <th className={`${DETAIL_TH} w-28`}>User</th>
          <th className={`${DETAIL_TH} w-32`}>Time</th>
          <th className={`${NUMBER_TH} w-28`}>Promised</th>
          <th className={`${DETAIL_TH} w-28`}>Follow up</th>
        </tr>
      </thead>
      <tbody className={`transition-opacity duration-150 ${stale ? 'opacity-60' : ''}`}>
        {items.map((entry, index) => {
          const time = [entry.start_time, entry.end_time].filter(Boolean).join(' – ')
          const kind = [entry.major_type, entry.type]
            .filter(Boolean)
            .filter((value, position, all) => all.indexOf(value) === position)
            .join(' · ')
          return (
            <tr key={`${entry.id}-${index}`} className={ROW}>
              <td className={DETAIL_TD}>{dateText(entry.date)}</td>
              <td className={DETAIL_TD}>
                <Clip value={kind} />
              </td>
              <td className={DETAIL_TD}>
                <Clip value={entry.outcome} />
              </td>
              <td className={`${DETAIL_TD} max-w-[12rem]`}>
                <Clip value={entry.subject} />
              </td>
              <td className={`${DETAIL_TD} max-w-[22rem]`}>
                <Clip value={entry.notes} />
              </td>
              <td className={DETAIL_TD}>
                <Clip
                  value={[entry.contact, entry.telephone].filter(Boolean).join(' · ')}
                />
              </td>
              <td className={DETAIL_TD}>
                <Clip value={entry.user} />
              </td>
              <td className={DETAIL_TD}>
                <Clip value={[time, entry.duration].filter(Boolean).join(' · ')} />
              </td>
              <td className={NUMBER_TD}>
                {entry.promised_payment === null ? (
                  <span className="text-text-muted">—</span>
                ) : (
                  <span
                    title={
                      entry.promised_payment_date
                        ? dateText(entry.promised_payment_date)
                        : undefined
                    }
                  >
                    {money(entry.promised_payment, currency)}
                  </span>
                )}
              </td>
              <td className={DETAIL_TD}>{dateText(entry.follow_up_date)}</td>
            </tr>
          )
        })}
      </tbody>
    </DetailTable>
  )
}

/** The newest invoices: each invoice number opens that invoice's own page (Sage 50 → Invoices). */
export function RecentInvoicesTable({
  items,
  currency,
}: {
  items: SageCustomerDetail['recent_invoices']
  currency: string | null
}) {
  const rows = items ?? []
  if (rows.length === 0) {
    return <DetailEmpty icon={FileTextIcon}>No invoices yet.</DetailEmpty>
  }
  return (
    <DetailTable>
      <thead>
        <tr>
          <th className={`${DETAIL_TH} w-36`}>Invoice number</th>
          <th className={`${DETAIL_TH} w-28`}>Type</th>
          <th className={`${DETAIL_TH} w-28`}>Date</th>
          <th className={DETAIL_TH}>Customer order</th>
          <th className={DETAIL_TH}>Sales order</th>
          <th className={`${NUMBER_TH} w-28`}>Gross</th>
          <th className={`${NUMBER_TH} w-28`}>Outstanding</th>
          <th className={`${DETAIL_TH} w-32 text-center`}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((invoice, index) => (
          <tr key={`${invoice.invoice_number}-${index}`} className={ROW}>
            <td className={DETAIL_TD}>
              {invoice.invoice_number ? (
                <Link
                  to={invoicePath(invoice.invoice_number, invoice.kind)}
                  state={{ linkedName: invoice.invoice_number }}
                  className="text-text hover:text-accent font-semibold no-underline hover:underline"
                >
                  {invoice.invoice_number}
                </Link>
              ) : (
                '—'
              )}
            </td>
            <td className={DETAIL_TD}>{humanize(invoice.kind) || '—'}</td>
            <td className={DETAIL_TD}>{dateText(invoice.invoice_date)}</td>
            <td className={DETAIL_TD}>
              <Clip value={invoice.customer_order_number} />
            </td>
            <td className={DETAIL_TD}>
              <Clip value={invoice.order_number} />
            </td>
            <td className={`${NUMBER_TD} font-semibold`}>
              {money(invoice.gross, currency)}
            </td>
            <td className={NUMBER_TD}>{money(invoice.outstanding, currency)}</td>
            <td className={`${DETAIL_TD} text-center`}>
              {invoice.payment_status ? (
                <Badge
                  tone={paymentTone(invoice.payment_status)}
                  className="w-24 justify-center"
                >
                  {humanize(invoice.payment_status)}
                </Badge>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </DetailTable>
  )
}

/** The newest sales orders. */
export function RecentOrdersTable({
  items,
  currency,
}: {
  items: SageCustomerDetail['recent_orders']
  currency: string | null
}) {
  const rows = items ?? []
  if (rows.length === 0) {
    return <DetailEmpty icon={OrdersIcon}>No sales orders yet.</DetailEmpty>
  }
  return (
    <DetailTable>
      <thead>
        <tr>
          <th className={`${DETAIL_TH} w-36`}>Order number</th>
          <th className={`${DETAIL_TH} w-28`}>Order date</th>
          <th className={`${DETAIL_TH} w-32`}>Status</th>
          <th className={DETAIL_TH}>Customer order</th>
          <th className={`${DETAIL_TH} w-32`}>Invoice</th>
          <th className={`${NUMBER_TH} w-28`}>Gross</th>
          <th className={`${DETAIL_TH} w-28`}>Despatch date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((order, index) => (
          <tr key={`${order.order_number}-${index}`} className={ROW}>
            <td className={`${DETAIL_TD} font-semibold`}>{order.order_number || '—'}</td>
            <td className={DETAIL_TD}>{dateText(order.order_date)}</td>
            <td className={DETAIL_TD}>{humanize(order.status) || '—'}</td>
            <td className={DETAIL_TD}>
              <Clip value={order.customer_order_number} />
            </td>
            <td className={DETAIL_TD}>
              {order.invoice_number ? (
                <Link
                  to={invoicePath(order.invoice_number, '')}
                  state={{ linkedName: order.invoice_number }}
                  className="text-text hover:text-accent no-underline hover:underline"
                >
                  {order.invoice_number}
                </Link>
              ) : (
                '—'
              )}
            </td>
            <td className={`${NUMBER_TD} font-semibold`}>
              {money(order.gross, currency)}
            </td>
            <td className={DETAIL_TD}>{dateText(order.despatch_date)}</td>
          </tr>
        ))}
      </tbody>
    </DetailTable>
  )
}

/** The tone of a transaction type's pill (the API's own type codes). */
const TYPE_TONES: Record<string, BadgeTone> = {
  SI: 'default',
  SR: 'success',
  SC: 'neutral',
  SA: 'warning',
  SD: 'danger',
  SP: 'default',
}

/**
 * The statement (after the shared reference design): the date (with the due date under it), the
 * reference, the type as a pill, the description, what was charged, what was paid and what is still
 * open — an overdue or disputed item says so under its outstanding amount. Amounts are signed by the
 * backend (credits negative) and shown as they come; the net and tax are on the amount's tooltip.
 */
export function StatementTable({
  items,
  currency,
  emptyText,
  stale = false,
}: {
  items: readonly SageTransaction[]
  currency: string | null
  emptyText: string
  stale?: boolean
}) {
  if (items.length === 0) {
    return <DetailEmpty icon={PoundIcon}>{emptyText}</DetailEmpty>
  }
  const suffix = currency ? ` (${currency})` : ''
  return (
    <DetailTable>
      <thead>
        <tr>
          <th className={`${DETAIL_TH} w-32`}>Date</th>
          <th className={`${DETAIL_TH} w-44`}>Reference</th>
          <th className={`${DETAIL_TH} w-40`}>Type</th>
          <th className={DETAIL_TH}>Description</th>
          <th className={`${NUMBER_TH} w-36`}>Amount{suffix}</th>
          <th className={`${NUMBER_TH} w-36`}>Paid{suffix}</th>
          <th className={`${NUMBER_TH} w-40`}>Outstanding{suffix}</th>
        </tr>
      </thead>
      <tbody className={`transition-opacity duration-150 ${stale ? 'opacity-60' : ''}`}>
        {items.map((item, index) => (
          <tr key={`${item.transaction_number}-${index}`} className={ROW}>
            <td className={DETAIL_TD}>
              <span className="block">{dateText(item.date)}</span>
              {item.due_date && (
                <span
                  className={`block text-[0.7rem] ${item.overdue ? 'text-danger' : 'text-text-muted'}`}
                >
                  Due {dateText(item.due_date)}
                </span>
              )}
            </td>
            <td className={DETAIL_TD}>
              <Clip value={item.reference || item.transaction_number} />
            </td>
            <td className={DETAIL_TD}>
              {item.type_label || item.type ? (
                <Badge tone={TYPE_TONES[item.type.toUpperCase()] ?? 'neutral'}>
                  {item.type_label || item.type}
                </Badge>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </td>
            <td className={`${DETAIL_TD} max-w-[20rem]`}>
              <Clip value={item.details} />
            </td>
            <td
              className={`${NUMBER_TD} font-semibold`}
              title={`Net ${money(item.net, currency)} · Tax ${money(item.tax, currency)}`}
            >
              {money(item.gross, currency)}
            </td>
            <td className={NUMBER_TD}>{money(item.paid, currency)}</td>
            <td
              className={`${NUMBER_TD} ${
                item.overdue
                  ? 'text-danger font-semibold'
                  : (item.outstanding ?? 0) !== 0
                    ? 'font-semibold'
                    : ''
              }`}
            >
              {money(item.outstanding, currency)}
              {(item.overdue || item.disputed) && (
                <span className="block text-[0.68rem] font-semibold uppercase">
                  {[item.overdue && 'Overdue', item.disputed && 'Disputed']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </DetailTable>
  )
}
