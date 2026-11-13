import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { UsersIcon } from '../../../components/ui/icons.tsx'
import type { CustomerTab } from '../hooks/useCustomerTabs.ts'
import { DRAFT_TAB } from '../utils/customerDraft.ts'

/** An order opened from a customer's Orders tab: a tab of its own in the strip, beside its customer. */
export interface CustomerOrderTab {
  /** `order:<customer id>:<store>:<order number>`. */
  id: string
  customerId: string
  customerName: string
  /** What the order is opened by: its number (17516). */
  ref: string
  label: string
  shop: string | null
}

interface CustomerTabsBarProps {
  tabs: CustomerTab[]
  /** Orders opened from a customer's page; each sits right after its customer's tab. */
  orderTabs?: CustomerOrderTab[]
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
export function CustomerTabsBar({
  tabs,
  orderTabs = [],
  draft = false,
  ...rest
}: CustomerTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      tabs={tabs
        .flatMap((tab) => [
          {
            id: tab.id,
            label: label(tab),
            title: tab.email ?? undefined,
            kind: undefined as string | undefined,
          },
          ...orderTabs
            .filter((order) => order.customerId === tab.id)
            .map((order) => ({
              id: order.id,
              label: order.label,
              title: `Order ${order.label} · ${order.customerName}`,
              kind: 'Order' as string | undefined,
            })),
        ])
        .concat(
          draft
            ? [
                {
                  id: DRAFT_TAB,
                  label: 'New customer',
                  title: 'A customer being added',
                  kind: undefined,
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
