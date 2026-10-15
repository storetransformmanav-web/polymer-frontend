export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'neutral'

/** The colours of each tone — shared by the Badge pill and controls styled like one. */
export const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-accent-tint text-accent',
  success: 'bg-accent-tint text-accent',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-surface text-text-muted border border-border',
}
