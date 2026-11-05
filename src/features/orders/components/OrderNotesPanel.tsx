import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSection } from '../../../components/ui/DetailSection.tsx'
import {
  BoxesIcon,
  ExternalLinkIcon,
  InfoIcon,
  ListChecksIcon,
} from '../../../components/ui/icons.tsx'
import type { OrderDetail } from '../../../lib/api/endpoints.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { humanize } from '../utils/format.ts'
import { orderTracking, type TrackingEntry } from '../utils/tracking.ts'

const EMPTY = 'text-text-muted m-0 text-[0.88rem]'
const LINK = 'text-accent inline-flex items-center gap-1 font-semibold hover:underline'

/** One parcel: who carries it, its number (with a copy button) and a link to follow it. */
function TrackingCard({ entry }: { entry: TrackingEntry }) {
  const link = safeUrl(entry.url)
  return (
    <li className="border-border bg-bg flex min-w-0 flex-col gap-2 rounded-xl border p-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        >
          <BoxesIcon width={18} height={18} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-text-muted text-[0.7rem] font-bold tracking-wide uppercase">
            {entry.label}
          </span>
          {entry.company && (
            <span className="truncate text-[0.92rem] font-semibold">{entry.company}</span>
          )}
        </div>
      </div>
      {entry.number && (
        <span className="flex items-center gap-1.5 font-mono text-[0.88rem] break-all">
          {entry.number}
          <CopyButton value={entry.number} label="Copy tracking number" />
        </span>
      )}
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className={LINK}>
          Track parcel
          <ExternalLinkIcon width={14} height={14} />
        </a>
      )}
    </li>
  )
}

/**
 * **Notes & Tracking**: the order's note, the tracking of its parcels (from its fulfillments and
 * any tracking details saved with the order) and the other details saved with it — each in its own
 * card, with a plain sentence when there is nothing. Only http(s) values are made links.
 */
export function OrderNotesPanel({ order }: { order: OrderDetail }) {
  const { tracking, details } = orderTracking(order)

  return (
    <div className="flex flex-col gap-4">
      <DetailSection title="Order note" icon={ListChecksIcon}>
        {order.note?.trim() ? (
          <p className="m-0 text-[0.9rem] leading-relaxed whitespace-pre-line">
            {order.note}
          </p>
        ) : (
          <p className={EMPTY}>No note on this order.</p>
        )}
      </DetailSection>

      <DetailSection title="Tracking" count={tracking.length} icon={BoxesIcon}>
        {tracking.length === 0 ? (
          <p className={EMPTY}>No tracking details yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {tracking.map((entry) => (
              <TrackingCard key={entry.key} entry={entry} />
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title="Additional details" count={details.length} icon={InfoIcon}>
        {details.length === 0 ? (
          <p className={EMPTY}>Nothing else was saved with this order.</p>
        ) : (
          <dl className="m-0 flex flex-col">
            {details.map((attribute, index) => {
              const value = attribute.value?.trim() ?? ''
              const link = safeUrl(value)
              return (
                <div
                  key={`${attribute.key}-${index}`}
                  className="border-border grid grid-cols-1 gap-1 border-b py-3 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="flex min-w-0 flex-col">
                    <span className="text-[0.88rem] font-semibold">
                      {humanize(attribute.key)}
                    </span>
                    <span className="text-text-muted font-mono text-[0.72rem] break-all">
                      {attribute.key}
                    </span>
                  </dt>
                  <dd className="m-0 flex min-w-0 items-start gap-1.5 text-[0.88rem] break-words">
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
      </DetailSection>
    </div>
  )
}
