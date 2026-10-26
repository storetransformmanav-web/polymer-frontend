import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  orderTabClosed,
  orderTabOpened,
  orderTabsCleared,
  type OrderTab,
} from '../../../app/store/ordersSlice.ts'

export type { OrderTab }

/**
 * The strip of opened orders above the list/details. Opening an order adds a tab (or
 * re-selects it); tabs live in Redux so they survive moving between the list and details,
 * and are dropped on logout.
 */
export function useOrderTabs() {
  const dispatch = useAppDispatch()
  const tabs = useAppSelector((state) => state.orders.tabs)

  return {
    tabs,
    openTab: (tab: {
      ref: string
      shop?: string | null
      label?: string
      title?: string | null
    }) => dispatch(orderTabOpened(tab)),
    closeTab: (id: string) => dispatch(orderTabClosed(id)),
    clearTabs: () => dispatch(orderTabsCleared()),
  }
}
