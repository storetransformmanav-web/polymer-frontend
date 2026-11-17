import { useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DetailsHeader,
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import {
  DetailEmpty,
  DetailSection,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import {
  ActivityIcon,
  AlertTriangleIcon,
  CalendarIcon,
  FileTextIcon,
  LayersIcon,
  ListChecksIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type { ActivityItem } from '../../../lib/api/endpoints.ts'
import { formatDateTimeAmPm } from '../../../lib/format.ts'
import { storeTimeZoneAbbreviation } from '../../../lib/storeTime.ts'
import {
  actionLabel,
  actorName,
  formatDuration,
  hasEntries,
  methodTone,
  readableSummary,
  statusTone,
  toJson,
} from '../utils/format.ts'

interface ActivityDetailsViewProps {
  /** The log entry, as the list read it (the API has no call for one entry on its own). */
  item: ActivityItem | null
  /** The entry's number, as in the address — shown when the entry itself is not at hand. */
  reference: string
  onBack: () => void
}

interface FrameProps {
  title: string
  status?: ReactNode
  chips?: ReactNode
  tabs: { id: string; label: string }[]
  tab: string
  onTab: (id: string) => void
  onBack: () => void
  children: ReactNode
}

/**
 * The frame of a product's and a customer's details page: a bordered article with the shared
 * header (a tile, the name, a status pill, the facts as chips, a rounded **Back to list**), a plain
 * text tab strip with an underline on the open one, and the tab's content on the soft panel below.
 */
function Frame({ title, status, chips, tabs, tab, onTab, onBack, children }: FrameProps) {
  return (
    <article className="border-border bg-bg flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1">
      <DetailsHeader
        visual={
          <HeaderTile>
            <ActivityIcon width={26} height={26} />
          </HeaderTile>
        }
        title={title}
        status={status}
        chips={chips}
        onBack={onBack}
      />

      <div
        role="tablist"
        aria-label="Activity sections"
        className="border-border flex [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`activity-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="activity-tabpanel"
              onClick={() => onTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[0.85rem] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? 'border-accent text-text'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div
        id="activity-tabpanel"
        role="tabpanel"
        aria-labelledby={`activity-tab-${tab}`}
        className="bg-surface flex flex-col gap-4 p-3 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {children}
      </div>
    </article>
  )
}

/** A block of free-form JSON from the API. It is shown as text only — never as markup. */
function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  const json = toJson(value)
  return (
    <DetailSection title={title} icon={FileTextIcon}>
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <CopyButton value={json} label={`Copy ${title.toLowerCase()}`} />
        </div>
        <pre className="border-border bg-surface max-h-[32rem] overflow-auto rounded-xl border p-3.5 font-mono text-[0.78rem] leading-relaxed break-all whitespace-pre-wrap">
          {json}
        </pre>
      </div>
    </DetailSection>
  )
}

const mono = (value: string, label: string): ReactNode =>
  value ? (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-[0.85rem] break-all">{value}</span>
      <CopyButton value={value} label={label} />
    </span>
  ) : null

/**
 * One activity entry's page, in place of the list and laid out like a product's and a customer's:
 * the shared header (a tile, "Activity #id", the status code as a pill, the method, when, who and
 * which action as chips, **Back to list**), a plain tab strip — **Overview** (summary, user, request,
 * entity), **Changes** and **Request details** — and clearly labelled cards on the soft panel.
 * Everything is shown as text (the free-form JSON in a `<pre>`), never as markup. The entry is the
 * row the list already read: the API has no call for one entry.
 */
export function ActivityDetailsView({
  item,
  reference,
  onBack,
}: ActivityDetailsViewProps) {
  const [tab, setTab] = useState('overview')

  // Reached by an address alone (a reload): the entry is not in memory.
  if (!item) {
    return (
      <Frame
        onBack={onBack}
        title={`Activity #${reference}`}
        tabs={[{ id: 'overview', label: 'Overview' }]}
        tab="overview"
        onTab={() => {}}
      >
        <div className="text-text-muted flex flex-col items-center gap-3 py-10 text-center text-[0.9rem]">
          <AlertTriangleIcon width={28} height={28} className="text-warning" />
          <p className="text-text m-0 font-semibold">This entry is not loaded</p>
          <p className="m-0">
            The activity log has no page for a single entry on its own. Go back to the
            list and open it from there.
          </p>
        </div>
      </Frame>
    )
  }

  const name = actorName(item.user)
  const zone = storeTimeZoneAbbreviation(item.time)
  const when = `${formatDateTimeAmPm(item.time)} ${zone}`.trim()
  const summary = readableSummary(item.summary, item.action)
  const hasChanges = hasEntries(item.changes) && !!item.changes
  const hasDetails = hasEntries(item.details) && !!item.details

  return (
    <Frame
      onBack={onBack}
      title={`Activity #${item.id}`}
      status={
        item.status_code !== null && item.status_code !== undefined ? (
          <StatusPill
            label={String(item.status_code)}
            tone={statusTone(item.status_code)}
          />
        ) : null
      }
      chips={
        <>
          {item.method && (
            <HeaderChip icon={FileTextIcon} label="Method">
              {item.method.toUpperCase()}
            </HeaderChip>
          )}
          <HeaderChip icon={CalendarIcon} label="Time">
            {when}
          </HeaderChip>
          <HeaderChip icon={UsersIcon} label="User">
            {name}
          </HeaderChip>
          <HeaderChip icon={ListChecksIcon} label="Action">
            {actionLabel(item.action)}
          </HeaderChip>
        </>
      }
      tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'changes', label: 'Changes' },
        { id: 'request', label: 'Request details' },
      ]}
      tab={tab}
      onTab={setTab}
    >
      {tab === 'overview' && (
        <div className="flex min-w-0 flex-col gap-4">
          <DetailSection title="Summary" icon={ActivityIcon}>
            <p className="m-0 mb-5 text-[1rem] leading-snug font-semibold break-words">
              {summary}
            </p>
            <FieldGrid>
              <Field label="Action">
                <span className="font-mono text-[0.85rem]">{item.action}</span>
              </Field>
              <Field label="Time">{when}</Field>
              <Field label="Duration">{formatDuration(item.duration_ms)}</Field>
            </FieldGrid>
          </DetailSection>

          <div className="grid gap-4 xl:grid-cols-2">
            <DetailSection title="User" icon={UsersIcon}>
              <FieldGrid>
                <Field label="Name">{name}</Field>
                <Field label="Email">{item.user?.email}</Field>
                <Field label="Role">{item.user?.role}</Field>
              </FieldGrid>
            </DetailSection>

            <DetailSection title="Request" icon={FileTextIcon}>
              <FieldGrid>
                <Field label="Method">
                  {item.method ? (
                    <Badge tone={methodTone(item.method)}>
                      {item.method.toUpperCase()}
                    </Badge>
                  ) : null}
                </Field>
                <Field label="Status">
                  {item.status_code !== null && item.status_code !== undefined ? (
                    <Badge tone={statusTone(item.status_code)}>{item.status_code}</Badge>
                  ) : null}
                </Field>
                <Field label="IP address">{mono(item.ip ?? '', 'Copy IP address')}</Field>
              </FieldGrid>
              <div className="mt-5 flex flex-col gap-5">
                <Field label="Path">{mono(item.path ?? '', 'Copy path')}</Field>
                <Field label="Device">{item.device}</Field>
              </div>
            </DetailSection>
          </div>

          <DetailSection title="Entity" icon={LayersIcon}>
            <FieldGrid>
              <Field label="Type">{item.entity_type}</Field>
              <Field label="Name">{item.entity_label}</Field>
              <Field label="ID">{mono(item.entity_id ?? '', 'Copy entity ID')}</Field>
            </FieldGrid>
          </DetailSection>
        </div>
      )}

      {tab === 'changes' &&
        (hasChanges && item.changes ? (
          <JsonBlock title="Changes" value={item.changes} />
        ) : (
          <DetailEmpty icon={LayersIcon}>This entry recorded no changes.</DetailEmpty>
        ))}

      {tab === 'request' &&
        (hasDetails && item.details ? (
          <JsonBlock title="Request details" value={item.details} />
        ) : (
          <DetailEmpty icon={FileTextIcon}>
            This entry recorded no request details.
          </DetailEmpty>
        ))}
    </Frame>
  )
}
