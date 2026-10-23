/**
 * The small icon buttons at the end of a list row (View, Delete, Open in Shopify): the same
 * 28px square with a 20px icon on every list page, tinted on hover. Keep a new row action
 * on these so the lists look alike.
 */
const ROW_ACTION_BASE =
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-text-muted transition-colors focus-visible:outline-2 focus-visible:outline-accent'

/** View, open, copy… */
export const ROW_ACTION = `${ROW_ACTION_BASE} hover:bg-accent-tint hover:text-accent`
/** Delete. */
export const ROW_ACTION_DANGER = `${ROW_ACTION_BASE} hover:bg-danger-bg hover:text-danger`
