export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'neutral'

/** The colours of each tone — shared by the Badge pill and controls styled like one. */
export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-accent-tint text-accent',
  success: 'bg-accent-tint text-accent',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-surface text-text-muted border border-border',
}

/**
 * The status-pill design: the tone's tint behind its colour, with a thin border of the same colour
 * (green RECEIVED / SELLABLE, red NON-SELLABLE…). The border *width* is the pill's own (`border`),
 * so a button styled like a pill can take these too.
 */
export const BADGE_OUTLINE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-accent-tint text-accent border-accent/30',
  success: 'bg-accent-tint text-accent border-accent/30',
  warning: 'bg-warning-bg text-warning border-warning/30',
  danger: 'bg-danger-bg text-danger border-danger/30',
  neutral: 'bg-surface text-text-muted border-border',
}

/** The shape and type of a status pill: a small rounded box, bold capitals, spaced out. */
export const BADGE_PILL_BASE =
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[0.66rem] leading-4 font-bold tracking-wide whitespace-nowrap uppercase'
