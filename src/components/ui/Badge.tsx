import type { ReactNode } from 'react'
import './Badge.css'

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'neutral'

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
}

/**
 * Small status pill (order/fulfillment/product status, etc). Generic
 * tone-based coloring, same tone vocabulary as StatCard.
 */
export function Badge({ tone = 'default', children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
