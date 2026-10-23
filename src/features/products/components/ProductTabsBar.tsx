import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { ProductsIcon } from '../../../components/ui/icons.tsx'
import type { ProductTab } from '../hooks/useProductTabs.ts'

interface ProductTabsBarProps {
  tabs: ProductTab[]
  /** The product whose details are showing, or null on the list. */
  activeId: string | null
  /** The "Add product" form, once opened — a tab of its own — and whether it is showing. */
  draft: { active: boolean } | null
  onSelectDraft: () => void
  onCloseDraft: () => void
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

const label = (tab: ProductTab) => tab.handle ?? `${tab.id.slice(0, 8)}…`
// Not a product id (those are UUIDs or numbers).
const DRAFT_ID = '__new-product__'

/** The strip of opened products: "All Products" returns to the list (see `OpenTabsBar`). */
export function ProductTabsBar({
  tabs,
  activeId,
  draft,
  onSelectDraft,
  onCloseDraft,
  onSelect,
  onClose,
  ...rest
}: ProductTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      activeId={draft?.active ? DRAFT_ID : activeId}
      onSelect={(id) => (id === DRAFT_ID ? onSelectDraft() : onSelect(id))}
      onClose={(id) => (id === DRAFT_ID ? onCloseDraft() : onClose(id))}
      tabs={[
        ...tabs.map((tab) => ({
          id: tab.id,
          label: label(tab),
          title: tab.title ?? undefined,
        })),
        ...(draft
          ? [{ id: DRAFT_ID, label: 'New product', title: 'A product being added' }]
          : []),
      ]}
      navLabel="Open products"
      listLabel="All Products"
      kind="Product"
      historyLabel="Opened products"
      icon={ProductsIcon}
    />
  )
}
