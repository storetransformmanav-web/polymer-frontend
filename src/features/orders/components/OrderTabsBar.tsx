import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { OrdersIcon } from '../../../components/ui/icons.tsx'
import type { OrderTab } from '../hooks/useOrderTabs.ts'

interface OrderTabsBarProps {
  tabs: OrderTab[]
  /** The tab of the order whose details are showing, or null on the list. */
  activeId: string | null
  /** The "Add order" form, once opened — a tab of its own — and whether it is showing. */
  draft?: { active: boolean } | null
  onSelectDraft?: () => void
  onCloseDraft?: () => void
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

// Not an order's key (those are "<shop>|<ref>").
const DRAFT_ID = '__new-order__'

/** The strip of opened orders: "All Orders" returns to the list (see `OpenTabsBar`). */
export function OrderTabsBar({
  tabs,
  activeId,
  draft = null,
  onSelectDraft,
  onCloseDraft,
  onSelect,
  onClose,
  ...rest
}: OrderTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      activeId={draft?.active ? DRAFT_ID : activeId}
      onSelect={(id) => (id === DRAFT_ID ? onSelectDraft?.() : onSelect(id))}
      onClose={(id) => (id === DRAFT_ID ? onCloseDraft?.() : onClose(id))}
      tabs={[
        ...tabs.map((tab) => ({
          id: tab.id,
          label: tab.label,
          title: tab.title ?? undefined,
        })),
        ...(draft
          ? [{ id: DRAFT_ID, label: 'New order', title: 'An order being added' }]
          : []),
      ]}
      navLabel="Open orders"
      listLabel="All Orders"
      kind="Order"
      historyLabel="Opened orders"
      icon={OrdersIcon}
    />
  )
}
