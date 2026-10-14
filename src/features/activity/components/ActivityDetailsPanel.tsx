import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { SidePanel } from '../../../components/ui/SidePanel.tsx'
import type { ActivityItem } from '../../../lib/api/endpoints.ts'
import { formatTimestamp } from '../../../lib/format.ts'
import {
  actionLabel,
  actorName,
  formatDuration,
  hasEntries,
  methodTone,
  statusTone,
  toJson,
} from '../utils/format.ts'

interface ActivityDetailsPanelProps {
  item: ActivityItem
  onClose: () => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-2.5 text-[0.88rem] last:border-b-0">
      <dt className="text-text-muted shrink-0">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  )
}

const dash = <span className="text-text-muted">—</span>

/** A block of free-form JSON from the API. It is shown as text only — never as markup. */
function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  const json = toJson(value)
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[0.9rem] font-semibold">{title}</h3>
        <CopyButton value={json} label={`Copy ${title.toLowerCase()}`} />
      </div>
      <pre className="border-border bg-surface max-h-72 overflow-auto rounded-xl border p-3.5 font-mono text-[0.78rem] leading-relaxed break-all whitespace-pre-wrap">
        {json}
      </pre>
    </section>
  )
}

/**
 * Everything the log recorded about one entry: who, what, when, from where,
 * how it went, and the request details / changes as readable JSON. Opens in
 * the same slide-over the other pages use.
 */
export function ActivityDetailsPanel({ item, onClose }: ActivityDetailsPanelProps) {
  const name = actorName(item.user)
  const entity = [item.entity_type, item.entity_label || item.entity_id]
    .filter(Boolean)
    .join(' · ')

  return (
    <SidePanel
      wide
      title={`Activity #${item.id}`}
      label={`Activity ${item.id} details`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg leading-snug font-semibold break-words">
            {item.summary || actionLabel(item.action)}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {item.method && (
              <Badge tone={methodTone(item.method)}>{item.method.toUpperCase()}</Badge>
            )}
            {item.status_code !== null && item.status_code !== undefined && (
              <Badge tone={statusTone(item.status_code)}>{item.status_code}</Badge>
            )}
            <span className="text-text-muted text-[0.8rem]">
              {formatTimestamp(item.time)}
            </span>
          </div>
        </div>

        <dl className="border-border rounded-xl border px-4">
          <Row label="User">
            {name}
            {item.user?.email && item.user.email !== name && (
              <span className="text-text-muted block text-[0.8rem] font-normal">
                {item.user.email}
              </span>
            )}
          </Row>
          <Row label="Role">{item.user?.role || dash}</Row>
          <Row label="Action">
            <span className="font-mono text-[0.82rem]">{item.action}</span>
          </Row>
          <Row label="Request">
            {item.method || item.path ? (
              <span className="font-mono text-[0.82rem] break-all">
                {[item.method, item.path].filter(Boolean).join(' ')}
              </span>
            ) : (
              dash
            )}
          </Row>
          <Row label="Duration">{formatDuration(item.duration_ms)}</Row>
          <Row label="Entity">{entity || dash}</Row>
          <Row label="IP address">
            {item.ip ? <span className="font-mono text-[0.82rem]">{item.ip}</span> : dash}
          </Row>
          <Row label="Device">{item.device || dash}</Row>
        </dl>

        {hasEntries(item.changes) && item.changes && (
          <JsonBlock title="Changes" value={item.changes} />
        )}
        {hasEntries(item.details) && item.details && (
          <JsonBlock title="Request details" value={item.details} />
        )}
      </div>
    </SidePanel>
  )
}
