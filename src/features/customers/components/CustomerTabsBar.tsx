import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { UsersIcon } from '../../../components/ui/icons.tsx'
import type { CustomerTab } from '../hooks/useCustomerTabs.ts'
import { DRAFT_TAB } from '../utils/customerDraft.ts'

interface CustomerTabsBarProps {
  tabs: CustomerTab[]
  /** The customer whose details are showing, or null on the list. */
  activeId: string | null
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
  /** The "New customer" form is open: it gets a tab of its own (`DRAFT_TAB`) after the customers. */
  draft?: boolean
}

const label = (tab: CustomerTab) => tab.name ?? `${tab.id.slice(0, 8)}…`

/** The strip of opened customers: "All Customers" returns to the list (see `OpenTabsBar`). */
export function CustomerTabsBar({ tabs, draft = false, ...rest }: CustomerTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      tabs={tabs
        .map((tab) => ({
          id: tab.id,
          label: label(tab),
          title: tab.email ?? undefined,
        }))
        .concat(
          draft
            ? [
                {
                  id: DRAFT_TAB,
                  label: 'New customer',
                  title: 'A customer being added',
                },
              ]
            : [],
        )}
      navLabel="Open customers"
      listLabel="All Customers"
      kind="Customer"
      historyLabel="Opened customers"
      icon={UsersIcon}
    />
  )
}
