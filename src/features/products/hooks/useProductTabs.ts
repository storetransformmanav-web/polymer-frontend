import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  tabClosed,
  tabOpened,
  tabsCleared,
  type ProductTab,
} from '../../../app/store/productsSlice.ts'

export type { ProductTab }

/**
 * The strip of opened products above the list/details. Opening a product
 * adds a tab (or re-selects it); tabs live in Redux so they survive moving
 * between the list and details, and are dropped on logout.
 */
export function useProductTabs() {
  const dispatch = useAppDispatch()
  const tabs = useAppSelector((state) => state.products.tabs)

  return {
    tabs,
    openTab: (tab: { id: string; handle?: string | null; title?: string | null }) =>
      dispatch(tabOpened(tab)),
    closeTab: (id: string) => dispatch(tabClosed(id)),
    clearTabs: () => dispatch(tabsCleared()),
  }
}
