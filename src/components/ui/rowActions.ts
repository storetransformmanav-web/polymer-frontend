/**
 * The small icon buttons at the end of a list row (View, Edit, Delete, Open in Shopify): the same
 * 28px square with a 15px icon (`ROW_ACTION_ICON`), 4px apart in a centred group (`ROW_ACTIONS`),
 * tinted on hover, on every list page. Keep a new row action on these so the lists look alike.
 */
const ROW_ACTION_BASE =
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-text-muted transition-colors focus-visible:outline-2 focus-visible:outline-accent'

/** View, open, copy… */
export const ROW_ACTION = `${ROW_ACTION_BASE} hover:bg-accent-tint hover:text-accent`
/** Delete. */
export const ROW_ACTION_DANGER = `${ROW_ACTION_BASE} hover:bg-danger-bg hover:text-danger`

/** The icon inside a row action, in px — pass it as both `width` and `height`. */
export const ROW_ACTION_ICON = 15
/** The group that holds a row's actions: centred, 4px apart. */
export const ROW_ACTIONS = 'inline-flex shrink-0 items-center justify-center gap-1'
