import type { ReactNode } from 'react'

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'neutral'

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-accent-tint text-accent',
  success: 'bg-accent-tint text-accent',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-surface text-text-muted border border-border',
}

/**
 * Small status pill (order/fulfillment/product status, etc). Generic
 * tone-based coloring, same tone vocabulary as StatCard.
 */
export function Badge({ tone = 'default', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}
