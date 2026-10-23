import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  customerTabClosed,
  customerTabOpened,
  customerTabsCleared,
  type CustomerTab,
} from '../../../app/store/customersSlice.ts'

export type { CustomerTab }

/**
 * The strip of opened customers above the list/details. Opening a customer adds a tab
 * (or re-selects it); tabs live in Redux so they survive moving between the list and
 * details, and are dropped on logout.
 */
export function useCustomerTabs() {
  const dispatch = useAppDispatch()
  const tabs = useAppSelector((state) => state.customers.tabs)

  return {
    tabs,
    openTab: (tab: { id: string; name?: string | null; email?: string | null }) =>
      dispatch(customerTabOpened(tab)),
    closeTab: (id: string) => dispatch(customerTabClosed(id)),
    clearTabs: () => dispatch(customerTabsCleared()),
  }
}
