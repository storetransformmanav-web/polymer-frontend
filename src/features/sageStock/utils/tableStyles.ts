import { DETAIL_TD, DETAIL_TH } from '../../../components/ui/DetailSection.tsx'

/** A number cell: right-aligned, digits lined up. */
export const NUMBER_TD = `${DETAIL_TD} text-right tabular-nums`

// The shared heading style has its own `text-left`; each heading sets its alignment alone. The heading
// stays on screen while the table scrolls under it, as in the lists.
export const TH = `${DETAIL_TH.replace('text-left', '')} sticky top-0 z-[1] backdrop-blur`
export const TH_LEFT = `${TH} text-left`
export const TH_CENTER = `${TH} text-center`
export const TH_RIGHT = `${TH} text-right`

/** A table's own scrolling box, as the lists have: it scrolls up and down under a sticky heading. */
export const SCROLL_BOX = 'relative max-h-[22rem] overflow-auto'

/**
 * A table's box on a tab whose table fills the page: as `SCROLL_BOX` below `lg`, but from `lg` up it takes
 * all the height the card has left, so the page does not grow and the pagination stays at the bottom.
 */
export const FILL_BOX =
  'relative max-h-[22rem] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1'
