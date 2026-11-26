import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { BoxesIcon, InfoIcon } from '../../../components/ui/icons.tsx'
import { formatDateTime } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { humanize } from '../utils/format.ts'
import { orderTracking, type TrackingEntry } from '../utils/tracking.ts'
import { EmptyNote, FoldCard, Row, Rows } from './OrderCompact.tsx'
import { OrderNoteCard, type OrderNoteCardProps } from './OrderNoteCard.tsx'

/** One parcel: what it belongs to, then carrier, number, link, delivery status and date. */
function TrackingCard({ entry }: { entry: TrackingEntry }) {
  const link = safeUrl(entry.url)
  return (
    <li className="border-border bg-surface/40 min-w-0 rounded-lg border px-2.5 py-1.5">
      <p className="text-text-muted m-0 flex items-center gap-1.5 py-1 text-[0.68rem] font-bold tracking-wide uppercase">
        <BoxesIcon width={13} height={13} className="text-accent shrink-0" />
        <span className="truncate">{entry.label}</span>
      </p>
      <Rows>
        <Row label="Carrier">{entry.company}</Row>
        <Row label="Tracking number">
          {entry.number && (
            <span className="flex items-center justify-end gap-1 font-mono text-[0.74rem] break-all">
              {entry.number}
              <CopyButton value={entry.number} label="Copy tracking number" />
            </span>
          )}
        </Row>
        <Row label="Tracking URL">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent break-all hover:underline"
            >
              {link}
            </a>
          )}
        </Row>
        <Row label="Delivery status">
          {entry.status && <Badge tone="neutral">{humanize(entry.status)}</Badge>}
        </Row>
        <Row label="Fulfillment date">
          {entry.date ? formatDateTime(entry.date) : null}
        </Row>
      </Rows>
    </li>
  )
}

/**
 * **Notes & Tracking**, three small sections you can fold: the **Order note**, the **Tracking** of
 * its parcels (from the fulfillments and any tracking detail saved with the order) and the
 * **Additional details** saved with it as name / value rows — a copy button beside each value, long
 * ids wrapping inside their row. Only http(s) values are made links. The note is the one thing that
 * can be edited (its pencil).
 */
export function OrderNotesPanel({ order, reference, shop }: OrderNoteCardProps) {
  const { tracking, details } = orderTracking(order)

  return (
    <div className="flex flex-col gap-2.5">
      <OrderNoteCard order={order} reference={reference} shop={shop} />

      <FoldCard title="Tracking" count={tracking.length} icon={BoxesIcon}>
        {tracking.length === 0 ? (
          <EmptyNote>No tracking details yet.</EmptyNote>
        ) : (
          <ul className="m-0 grid list-none gap-2.5 p-0 py-1 md:grid-cols-2">
            {tracking.map((entry) => (
              <TrackingCard key={entry.key} entry={entry} />
            ))}
          </ul>
        )}
      </FoldCard>

      <FoldCard title="Additional details" count={details.length} icon={InfoIcon}>
        {details.length === 0 ? (
          <EmptyNote>Nothing else was saved with this order.</EmptyNote>
        ) : (
          <dl className="m-0 flex flex-col">
            {details.map((attribute, index) => {
              const value = attribute.value?.trim() ?? ''
              const link = safeUrl(value)
              return (
                <div
                  key={`${attribute.key}-${index}`}
                  className="border-border grid grid-cols-1 gap-0.5 border-b py-1.5 text-[0.78rem] last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-3"
                >
                  <dt className="flex min-w-0 flex-col">
                    <span className="font-semibold">{humanize(attribute.key)}</span>
                    <span className="text-text-muted font-mono text-[0.68rem] break-all">
                      {attribute.key}
                    </span>
                  </dt>
                  <dd className="m-0 flex min-w-0 items-start gap-1.5 break-words">
                    {value === '' ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <>
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent break-all hover:underline"
                          >
                            {value}
                          </a>
                        ) : (
                          <span className="break-all">{value}</span>
                        )}
                        <CopyButton
                          value={value}
                          label={`Copy ${humanize(attribute.key)}`}
                        />
                      </>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}
      </FoldCard>
    </div>
  )
}
