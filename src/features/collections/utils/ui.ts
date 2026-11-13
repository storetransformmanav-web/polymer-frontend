/** Class names and small helpers shared by the collection pages. */

export const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

export const PRIMARY_BUTTON =
  'bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-4 text-[0.85rem] font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50'

export const SECONDARY_BUTTON =
  'border-border bg-bg text-text hover:border-accent inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** A count with thousands separators, or a dash. */
export const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('en-GB')
