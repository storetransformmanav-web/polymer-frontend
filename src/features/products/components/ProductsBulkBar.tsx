import { PencilIcon, PlusIcon } from '../../../components/ui/icons.tsx'
import { PopoverButton } from '../../../components/ui/PopoverButton.tsx'

interface ProductsBulkActionsProps {
  /** Products on the page being shown. */
  pageCount: number
  /** Ticked products on this page. */
  selectedCount: number
  /** Opens the "Add product" form. */
  onAdd: () => void
  /** The pointer reached "Add product": warm up what the form needs (the editor). */
  onAddIntent?: () => void
  onEditPage: () => void
  onEditSelected: () => void
  /** The menu was opened: warm the products' details so the editor opens populated. */
  onPrepare: () => void
}

const ITEM =
  'hover:bg-accent-tint/60 flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg border-none bg-transparent px-3 py-2.5 text-left transition-colors disabled:pointer-events-none disabled:opacity-50'

const plural = (count: number) => `${count} product${count === 1 ? '' : 's'}`

/**
 * **Add product** and the **Edit in bulk** icon (a menu: edit every product on this page,
 * or just the ticked ones). They sit in the toolbar's search row, between the Filters
 * button and Clear All.
 */
export function ProductsBulkActions({
  pageCount,
  selectedCount,
  onAdd,
  onAddIntent,
  onEditPage,
  onEditSelected,
  onPrepare,
}: ProductsBulkActionsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onAdd}
        onPointerEnter={onAddIntent}
        onFocus={onAddIntent}
        className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border-none px-3.5 text-[0.82rem] font-semibold shadow-sm transition-colors"
      >
        <PlusIcon width={16} height={16} />
        Add product
      </button>
      <PopoverButton
        label="Edit in bulk"
        icon={PencilIcon}
        iconOnly
        chevron={false}
        align="right"
        tone={selectedCount > 0 ? 'primary' : 'neutral'}
        disabled={pageCount === 0}
        onOpen={onPrepare}
      >
        {(close) => (
          <div role="menu" aria-label="Bulk edit options" className="flex flex-col">
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => {
                close()
                onEditPage()
              }}
            >
              <span className="text-[0.88rem] font-semibold">Edit this page</span>
              <span className="text-text-muted text-[0.78rem]">
                All {plural(pageCount)} shown here
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              disabled={selectedCount === 0}
              onClick={() => {
                close()
                onEditSelected()
              }}
            >
              <span className="text-[0.88rem] font-semibold">Edit selected</span>
              <span className="text-text-muted text-[0.78rem]">
                {selectedCount > 0
                  ? `Only the ${plural(selectedCount)} you ticked`
                  : 'Tick one or more products first'}
              </span>
            </button>
          </div>
        )}
      </PopoverButton>
    </>
  )
}

/** "N selected · Clear selection" — shown above the list only while rows are ticked. */
export function ProductsSelectionNote({
  selectedCount,
  onClearSelection,
}: {
  selectedCount: number
  onClearSelection: () => void
}) {
  if (selectedCount === 0) return null
  return (
    <div className="border-border bg-bg rounded-2xl border px-4 py-2.5">
      <p className="text-text-muted text-[0.82rem]">
        <span className="text-text font-semibold">{selectedCount} selected</span>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-accent ml-3 cursor-pointer border-none bg-transparent p-0 text-[0.82rem] font-semibold hover:underline"
        >
          Clear selection
        </button>
      </p>
    </div>
  )
}
