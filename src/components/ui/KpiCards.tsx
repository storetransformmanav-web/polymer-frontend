import type { ComponentType, ReactNode } from 'react'
import { ArrowUpRightIcon, type IconProps } from './icons.tsx'
import { InfoTip } from './InfoTip.tsx'

export interface Kpi {
  label: string
  value: ReactNode
  /** Small text beside the value. */
  note?: string
  /** One short line under the figure saying what it counts. */
  hint?: string
  icon: ComponentType<IconProps>
  tone?: 'default' | 'good' | 'warning' | 'danger'
  /** Makes the whole card a button (a filter): what it does when pressed. */
  onClick?: () => void
  /** For a clickable card: the filter it stands for is on. */
  active?: boolean
  /** For a clickable card: its tooltip, instead of "Show only: <label>". */
  title?: string
  /** What the card counts: a small (i) right after the title opens it as a tooltip (it is never part of the click). */
  info?: string
}

const VALUE_TONE = {
  default: 'text-text',
  good: 'text-accent',
  warning: 'text-warning',
  danger: 'text-danger',
}

/** A row of four (or five) headline figures above a list (label, big value, icon) — generic. */
export function KpiCards({ items }: { items: Kpi[] }) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 ${
        items.length === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'
      }`}
    >
      {items.map((kpi) => {
        if (kpi.info) return <InfoCard key={kpi.label} kpi={kpi} info={kpi.info} />
        const card = `border-border bg-bg flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${
          kpi.onClick
            ? `group relative hover:border-accent focus-visible:outline-accent w-full cursor-pointer text-left transition-colors focus-visible:outline-2 ${
                kpi.active ? 'border-accent bg-accent-tint ring-accent ring-1' : ''
              }`
            : ''
        }`
        const body = (
          <>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-text-muted text-[0.68rem] font-bold tracking-wider uppercase">
                {kpi.label}
              </span>
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span
                  className={`text-[1.55rem] leading-tight font-bold ${VALUE_TONE[kpi.tone ?? 'default']}`}
                >
                  {kpi.value}
                </span>
                {kpi.note && (
                  <span className="text-text-muted text-[0.74rem]">{kpi.note}</span>
                )}
              </span>
              {kpi.hint && (
                <span className="text-text-muted text-[0.72rem] leading-snug">
                  {kpi.hint}
                </span>
              )}
            </div>
            <span className="bg-surface text-text border-border flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
              <kpi.icon width={18} height={18} />
            </span>
            {kpi.onClick && (
              // Tells people the card is clickable (it is a filter button).
              <span
                aria-hidden="true"
                className={`absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-md transition-colors ${
                  kpi.active
                    ? 'bg-accent text-bg'
                    : 'text-text-muted group-hover:bg-accent-tint group-hover:text-accent'
                }`}
              >
                <ArrowUpRightIcon width={13} height={13} />
              </span>
            )}
          </>
        )
        return kpi.onClick ? (
          <button
            key={kpi.label}
            type="button"
            aria-pressed={kpi.active ?? false}
            title={
              kpi.title ??
              (kpi.active
                ? `Showing only: ${kpi.label}. Click to show all.`
                : `Show only: ${kpi.label}`)
            }
            onClick={kpi.onClick}
            className={card}
          >
            {body}
          </button>
        ) : (
          <div key={kpi.label} className={card}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

/**
 * A card with an (i) right after its title. A clickable card cannot hold another control inside its
 * button, so the button is a transparent layer over the whole card and the text sits above it (it lets
 * clicks through); only the (i) takes the pointer, so pointing at or focusing it never presses the
 * card.
 */
function InfoCard({ kpi, info }: { kpi: Kpi; info: string }) {
  const clickable = !!kpi.onClick
  return (
    <div
      className={`border-border bg-bg group relative flex h-full items-center justify-between gap-3 rounded-2xl border px-5 py-4 transition-colors ${
        clickable ? 'hover:border-accent' : ''
      } ${kpi.active ? 'border-accent bg-accent-tint ring-accent ring-1' : ''}`}
    >
      {kpi.onClick && (
        <button
          type="button"
          aria-pressed={kpi.active ?? false}
          aria-label={`${kpi.label}: ${typeof kpi.value === 'string' || typeof kpi.value === 'number' ? kpi.value : ''}`}
          title={
            kpi.title ??
            (kpi.active
              ? `Showing only: ${kpi.label}. Click to show all.`
              : `Show only: ${kpi.label}`)
          }
          onClick={kpi.onClick}
          className="focus-visible:outline-accent absolute inset-0 cursor-pointer rounded-2xl border-none bg-transparent focus-visible:outline-2"
        />
      )}
      <div className="pointer-events-none relative flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <span className="text-text-muted text-[0.68rem] font-bold tracking-wider uppercase">
            {kpi.label}
          </span>
          <span className="pointer-events-auto flex">
            <InfoTip label={kpi.label} text={info} />
          </span>
        </span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span
            className={`text-[1.55rem] leading-tight font-bold ${VALUE_TONE[kpi.tone ?? 'default']}`}
          >
            {kpi.value}
          </span>
          {kpi.note && <span className="text-text-muted text-[0.74rem]">{kpi.note}</span>}
        </span>
        {kpi.hint && (
          <span className="text-text-muted text-[0.72rem] leading-snug">{kpi.hint}</span>
        )}
      </div>
      <span className="bg-surface text-text border-border pointer-events-none relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
        <kpi.icon width={18} height={18} />
      </span>
      {kpi.onClick && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-md transition-colors ${
            kpi.active
              ? 'bg-accent text-bg'
              : 'text-text-muted group-hover:bg-accent-tint group-hover:text-accent'
          }`}
        >
          <ArrowUpRightIcon width={13} height={13} />
        </span>
      )}
    </div>
  )
}
