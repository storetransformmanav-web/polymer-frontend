import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { UsersIcon } from '../../../components/ui/icons.tsx'
import type { CustomerTab } from '../hooks/useCustomerTabs.ts'

interface CustomerTabsBarProps {
  tabs: CustomerTab[]
  /** The customer whose details are showing, or null on the list. */
  activeId: string | null
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

const label = (tab: CustomerTab) => tab.name ?? `${tab.id.slice(0, 8)}…`

/** The strip of opened customers: "All Customers" returns to the list (see `OpenTabsBar`). */
export function CustomerTabsBar({ tabs, ...rest }: CustomerTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: label(tab),
        title: tab.email ?? undefined,
      }))}
      navLabel="Open customers"
      listLabel="All Customers"
      kind="Customer"
      historyLabel="Opened customers"
      icon={UsersIcon}
    />
  )
}
