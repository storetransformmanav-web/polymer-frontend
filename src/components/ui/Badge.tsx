import type { ReactNode } from 'react'
import { BADGE_TONE_CLASSES, type BadgeTone } from './badgeTones.ts'

export type { BadgeTone }

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
}

/**
 * Small status pill (order/fulfillment/product status, etc). Generic
 * tone-based coloring, same tone vocabulary as StatCard.
 */
export function Badge({ tone = 'default', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${BADGE_TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}
