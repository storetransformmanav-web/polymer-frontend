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
  /**
   * A customer's or product's details opened from an order, in this same page: a tab of its
   * own (labelled "Customer" / "Product"), showing while that page is on screen.
   */
  linked?: { kind: string; label: string } | null
  onCloseLinked?: () => void
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

// Not an order's key (those are "<shop>|<ref>").
const DRAFT_ID = '__new-order__'
const LINKED_ID = '__linked__'

/** The strip of opened orders: "All Orders" returns to the list (see `OpenTabsBar`). */
export function OrderTabsBar({
  tabs,
  activeId,
  draft = null,
  onSelectDraft,
  onCloseDraft,
  linked = null,
  onCloseLinked,
  onSelect,
  onClose,
  ...rest
}: OrderTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      activeId={linked ? LINKED_ID : draft?.active ? DRAFT_ID : activeId}
      onSelect={(id) => {
        if (id === LINKED_ID) return
        if (id === DRAFT_ID) onSelectDraft?.()
        else onSelect(id)
      }}
      onClose={(id) => {
        if (id === LINKED_ID) onCloseLinked?.()
        else if (id === DRAFT_ID) onCloseDraft?.()
        else onClose(id)
      }}
      tabs={[
        ...tabs.map((tab) => ({
          id: tab.id,
          label: tab.label,
          title: tab.title ?? undefined,
        })),
        ...(draft
          ? [{ id: DRAFT_ID, label: 'New order', title: 'An order being added' }]
          : []),
        ...(linked
          ? [
              {
                id: LINKED_ID,
                label: linked.label,
                kind: linked.kind,
                title: linked.label,
              },
            ]
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
