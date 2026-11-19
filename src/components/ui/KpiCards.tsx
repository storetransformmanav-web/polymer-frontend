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

/**
 * A row of four (or five) headline figures above a list (label, big value, icon) — generic.
 * `compact` is the dense look for a long row (the Orders page's eight cards): smaller type, tighter
 * padding, a small icon tile that gives way when the card is narrow, and all of them (seven or eight)
 * in one row from 1280px up (four on medium screens, two on phones). It applies to cards that have an `info` tooltip.
 */
export function KpiCards({
  items,
  compact = false,
}: {
  items: Kpi[]
  compact?: boolean
}) {
  return (
    <div
      className={
        compact
          ? `grid grid-cols-2 gap-3 md:grid-cols-4 ${
              items.length === 6
                ? 'xl:grid-cols-6'
                : items.length === 7
                  ? 'xl:grid-cols-7'
                  : 'xl:grid-cols-8'
            }`
          : `grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 ${
              items.length === 6
                ? 'xl:grid-cols-6'
                : items.length === 5
                  ? 'xl:grid-cols-5'
                  : 'xl:grid-cols-4'
            }`
      }
    >
      {items.map((kpi) => {
        if (kpi.info) {
          return <InfoCard key={kpi.label} kpi={kpi} info={kpi.info} compact={compact} />
        }
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
function InfoCard({ kpi, info, compact }: { kpi: Kpi; info: string; compact: boolean }) {
  const clickable = !!kpi.onClick
  return (
    <div
      className={`border-border bg-bg group relative flex h-full items-center justify-between transition-colors ${
        compact
          ? '@container min-w-0 gap-2 rounded-xl border px-3 py-2.5'
          : 'gap-3 rounded-2xl border px-5 py-4'
      } ${clickable ? 'hover:border-accent' : ''} ${
        kpi.active ? 'border-accent bg-accent-tint ring-accent ring-1' : ''
      }`}
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
          className={`focus-visible:outline-accent absolute inset-0 cursor-pointer border-none bg-transparent focus-visible:outline-2 ${
            compact ? 'rounded-xl' : 'rounded-2xl'
          }`}
        />
      )}
      <div
        className={`pointer-events-none relative flex min-w-0 flex-col ${compact ? 'gap-0.5' : 'gap-1'}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={
              compact
                ? 'text-text-muted truncate text-[0.66rem] leading-tight font-semibold'
                : 'text-text-muted text-[0.68rem] font-bold tracking-wider uppercase'
            }
          >
            {kpi.label}
          </span>
          <span className="pointer-events-auto flex">
            <InfoTip label={kpi.label} text={info} />
          </span>
        </span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span
            className={`leading-tight font-bold ${
              compact ? 'text-[0.95rem] @[9rem]:text-[1.05rem]' : 'text-[1.55rem]'
            } ${VALUE_TONE[kpi.tone ?? 'default']}`}
          >
            {kpi.value}
          </span>
          {kpi.note && (
            <span
              className={`text-text-muted ${compact ? 'text-[0.62rem]' : 'text-[0.74rem]'}`}
            >
              {kpi.note}
            </span>
          )}
        </span>
        {kpi.hint && (
          <span
            className={`text-text-muted leading-snug ${compact ? 'text-[0.62rem]' : 'text-[0.72rem]'}`}
          >
            {kpi.hint}
          </span>
        )}
      </div>
      {/* Compact: the icon tile only shows when the card is wide enough for it (container query). */}
      <span
        className={`bg-surface text-text border-border pointer-events-none relative shrink-0 items-center justify-center border ${
          compact
            ? 'hidden h-7 w-7 rounded-lg @[10.5rem]:flex'
            : 'flex h-10 w-10 rounded-xl'
        }`}
      >
        <kpi.icon width={compact ? 14 : 18} height={compact ? 14 : 18} />
      </span>
      {kpi.onClick && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute flex items-center justify-center rounded-md transition-colors ${
            compact ? 'top-1 right-1 h-4 w-4' : 'top-2 right-2 h-5 w-5'
          } ${
            kpi.active
              ? 'bg-accent text-bg'
              : 'text-text-muted group-hover:bg-accent-tint group-hover:text-accent'
          }`}
        >
          <ArrowUpRightIcon width={compact ? 10 : 13} height={compact ? 10 : 13} />
        </span>
      )}
    </div>
  )
}
