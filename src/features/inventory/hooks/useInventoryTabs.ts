import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  tabClosed,
  tabOpened,
  tabsCleared,
  type InventoryTab,
} from '../../../app/store/inventorySlice.ts'

export type { InventoryTab }

/**
 * The strip of opened variants above the list/details. Opening a variant adds a tab (or
 * re-selects it); tabs live in Redux so they survive moving between the list and details, and
 * are dropped on logout.
 */
export function useInventoryTabs() {
  const dispatch = useAppDispatch()
  const tabs = useAppSelector((state) => state.inventory.tabs)

  return {
    tabs,
    openTab: (tab: { id: string; title?: string | null; variantTitle?: string | null }) =>
      dispatch(tabOpened(tab)),
    closeTab: (id: string) => dispatch(tabClosed(id)),
    clearTabs: () => dispatch(tabsCleared()),
  }
}
