import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { OrdersIcon } from '../../../components/ui/icons.tsx'
import type { OrderTab } from '../hooks/useOrderTabs.ts'

interface OrderTabsBarProps {
  tabs: OrderTab[]
  /** The tab of the order whose details are showing, or null on the list. */
  activeId: string | null
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

/** The strip of opened orders: "All Orders" returns to the list (see `OpenTabsBar`). */
export function OrderTabsBar({ tabs, ...rest }: OrderTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        title: tab.title ?? undefined,
      }))}
      navLabel="Open orders"
      listLabel="All Orders"
      kind="Order"
      historyLabel="Opened orders"
      icon={OrdersIcon}
    />
  )
}
