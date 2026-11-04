import { InventoryIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import type { InventoryTab } from '../hooks/useInventoryTabs.ts'

interface InventoryTabsBarProps {
  tabs: InventoryTab[]
  /** The variant whose stock is showing, or null on the list. */
  activeId: string | null
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

const label = (tab: InventoryTab) =>
  tab.variantTitle && tab.variantTitle.toLowerCase() !== 'default title'
    ? tab.variantTitle
    : (tab.title ?? `${tab.id.slice(0, 8)}…`)

/** The strip of opened variants: "All Inventory" returns to the list (see `OpenTabsBar`). */
export function InventoryTabsBar({ tabs, ...rest }: InventoryTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      tabs={tabs.map((tab) => ({
        id: tab.id,
        label: label(tab),
        title: tab.title ?? undefined,
      }))}
      navLabel="Open variants"
      listLabel="All Inventory"
      kind="Variant"
      historyLabel="Opened variants"
      icon={InventoryIcon}
    />
  )
}
