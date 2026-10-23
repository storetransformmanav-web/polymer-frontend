import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from './icons.tsx'

export interface Kpi {
  label: string
  value: ReactNode
  /** Small text beside the value. */
  note?: string
  icon: ComponentType<IconProps>
  tone?: 'default' | 'good' | 'warning' | 'danger'
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
      {items.map((kpi) => (
        <div
          key={kpi.label}
          className="border-border bg-bg flex items-center justify-between gap-3 rounded-2xl border px-5 py-4"
        >
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
          </div>
          <span className="bg-surface text-text border-border flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <kpi.icon width={18} height={18} />
          </span>
        </div>
      ))}
    </div>
  )
}
