/** Class lists and limits shared by the Lock Access tab's cards (one look for all of them). */

export const CARD = 'border-border bg-bg rounded-2xl border'
export const TILE =
  'bg-accent-tint text-accent border-accent/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border'
export const PRIMARY =
  'bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3.5 text-[0.82rem] font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50'
export const OUTLINE =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
export const DANGER_OUTLINE =
  'border-danger text-danger hover:bg-danger-bg inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-transparent font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
export const CHIP =
  'bg-accent-tint text-accent inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[0.75rem] font-semibold'
export const CHIP_X =
  'hover:bg-accent hover:text-accent-contrast flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current transition-colors'
export const CHECKBOX = 'accent-accent m-0 h-4 w-4 shrink-0 cursor-pointer'
export const COUNT_BADGE =
  'bg-accent-tint text-accent shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-bold whitespace-nowrap'
/** The box a search or a typed tag goes in. */
export const SEARCH_BOX =
  'border-border bg-surface focus-within:border-accent flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 transition-colors'
export const SEARCH_INPUT =
  'text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.83rem] outline-none [&::-webkit-search-cancel-button]:hidden'
/** The list that drops down under a search box. */
export const DROPDOWN =
  'border-border bg-bg absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-lg border shadow-lg outline-none'

/** At most this many customers are given access in one go (the API's own limit). */
export const MAX_CUSTOMERS = 250
/** At most this many keys (tags) on one lock (the API's own limit). */
export const MAX_KEYS = 20

export const lowerSet = (tags: readonly string[]) =>
  new Set(tags.map((tag) => tag.toLowerCase()))

/**
 * Soft colour washes for the stat cards. Mixed with the page's own `--color-bg`, so they stay
 * subtle (and right) in the dark theme too.
 */
export const STAT_TONES = {
  green: {
    card: 'from-accent-tint to-bg',
    tile: 'bg-accent-tint text-accent border-accent/20',
  },
  blue: {
    card: 'from-[color-mix(in_srgb,#3b82f6_10%,var(--color-bg))] to-bg',
    tile: 'bg-[color-mix(in_srgb,#3b82f6_16%,var(--color-bg))] text-[#3b82f6] border-[#3b82f6]/20',
  },
  violet: {
    card: 'from-[color-mix(in_srgb,#8b5cf6_10%,var(--color-bg))] to-bg',
    tile: 'bg-[color-mix(in_srgb,#8b5cf6_16%,var(--color-bg))] text-[#8b5cf6] border-[#8b5cf6]/20',
  },
} as const
