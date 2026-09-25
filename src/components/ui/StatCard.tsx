import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from './icons.tsx'

export type StatCardTone = 'default' | 'warning' | 'danger'

const ICON_TONE_CLASSES: Record<StatCardTone, string> = {
  default: 'bg-accent-tint text-accent',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
}

const META_TONE_CLASSES: Record<StatCardTone, string> = {
  default: 'text-text-muted',
  warning: 'text-warning',
  danger: 'text-danger',
}

export interface StatCardProps {
  icon?: ComponentType<IconProps>
  label: string
  value: ReactNode
  meta?: ReactNode
  tone?: StatCardTone
}

/**
 * A single metric tile: icon badge, label, big value, and a short meta
 * line. Generic enough to use for any KPI grid across features.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  meta,
  tone = 'default',
}: StatCardProps) {
  return (
    <div className="border-border bg-bg flex flex-col gap-2.5 rounded-xl border px-5 py-4.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-muted text-[0.78rem] font-semibold">{label}</span>
        {Icon && (
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ICON_TONE_CLASSES[tone]}`}
          >
            <Icon />
          </span>
        )}
      </div>
      <span className="text-text text-2xl font-bold">{value}</span>
      {meta && (
        <span className={`text-[0.78rem] ${META_TONE_CLASSES[tone]}`}>{meta}</span>
      )}
    </div>
  )
}

/** Shared grid layout for a row of StatCards — used by any page that
 * shows a KPI summary. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,300px))] gap-4">
      {children}
    </div>
  )
}
