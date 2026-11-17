import { InAppBar, REFRESH_SLOT_ID } from './AppBarSlot.tsx'
import { RefreshButton } from './ExportControls.tsx'

/**
 * The **Refresh** button of a listing page, in the top bar just right of the clock. It only asks
 * for the page's own list again (`onRefresh` — the page decides what that means; nothing reloads
 * and nobody navigates away), spins while that is being read, and is off meanwhile so it cannot
 * be pressed twice. `visible` is false while the page shows something other than its list (an
 * open record, a form), so the button is only there when it has a list to refresh.
 */
export function HeaderRefresh({
  onRefresh,
  refreshing,
  visible = true,
}: {
  onRefresh: () => void
  refreshing: boolean
  visible?: boolean
}) {
  if (!visible) return null
  return (
    <InAppBar slotId={REFRESH_SLOT_ID}>
      <RefreshButton refreshing={refreshing} onClick={onRefresh} />
    </InAppBar>
  )
}
