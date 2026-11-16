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
  /** The locks opened from the list's lock icon: a tab each, beside the products'. */
  locks?: { id: string; label: string; title?: string }[]
  /** The lock whose page is showing, if any (it wins over `activeId`). */
  activeLockId?: string | null
  onSelectLock?: (id: string) => void
  onCloseLock?: (id: string) => void
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

const label = (tab: ProductTab) => tab.handle ?? `${tab.id.slice(0, 8)}…`
// Not a product id (those are UUIDs or numbers).
const DRAFT_ID = '__new-product__'
const LOCK_PREFIX = 'lock:'

/** The strip of opened products: "All Products" returns to the list (see `OpenTabsBar`). */
export function ProductTabsBar({
  tabs,
  activeId,
  draft,
  onSelectDraft,
  onCloseDraft,
  locks = [],
  activeLockId = null,
  onSelectLock,
  onCloseLock,
  onSelect,
  onClose,
  ...rest
}: ProductTabsBarProps) {
  return (
    <OpenTabsBar
      {...rest}
      activeId={
        draft?.active
          ? DRAFT_ID
          : activeLockId
            ? `${LOCK_PREFIX}${activeLockId}`
            : activeId
      }
      onSelect={(id) =>
        id === DRAFT_ID
          ? onSelectDraft()
          : id.startsWith(LOCK_PREFIX)
            ? onSelectLock?.(id.slice(LOCK_PREFIX.length))
            : onSelect(id)
      }
      onClose={(id) =>
        id === DRAFT_ID
          ? onCloseDraft()
          : id.startsWith(LOCK_PREFIX)
            ? onCloseLock?.(id.slice(LOCK_PREFIX.length))
            : onClose(id)
      }
      tabs={[
        ...tabs.map((tab) => ({
          id: tab.id,
          label: label(tab),
          title: tab.title ?? undefined,
        })),
        ...locks.map((lock) => ({
          id: `${LOCK_PREFIX}${lock.id}`,
          label: lock.label,
          title: lock.title,
          kind: 'Lock',
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
