import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from './icons.tsx'

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
}

const VALUE_TONE = {
  default: 'text-text',
  good: 'text-accent',
  warning: 'text-warning',
  danger: 'text-danger',
}

/** A row of four headline figures above a list (label, big value, icon) — generic. */
export function KpiCards({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4">
      {items.map((kpi) => {
        const card = `border-border bg-bg flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${
          kpi.onClick
            ? `hover:border-accent focus-visible:outline-accent w-full cursor-pointer text-left transition-colors focus-visible:outline-2 ${
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
          </>
        )
        return kpi.onClick ? (
          <button
            key={kpi.label}
            type="button"
            aria-pressed={kpi.active ?? false}
            title={
              kpi.active
                ? `Showing only: ${kpi.label}. Click to show all.`
                : `Show only: ${kpi.label}`
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
