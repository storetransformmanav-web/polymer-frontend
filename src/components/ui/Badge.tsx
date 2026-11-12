import type { ReactNode } from 'react'
import { BADGE_OUTLINE_CLASSES, BADGE_PILL_BASE, type BadgeTone } from './badgeTones.ts'

export type { BadgeTone }

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  /** Extra classes — e.g. a fixed width with `justify-center` so a column of pills lines up. */
  className?: string
}

/**
 * Small status pill (order/fulfillment/product status, etc): a tinted box with a thin border of
 * the tone's colour and bold capitals — RECEIVED, SELLABLE, NON-SELLABLE. Generic tone-based
 * coloring, same tone vocabulary as StatCard.
 */
export function Badge({ tone = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`${BADGE_PILL_BASE} ${BADGE_OUTLINE_CLASSES[tone]} ${className}`}>
      {children}
    </span>
  )
}
