import { PencilIcon } from '../../../components/ui/icons.tsx'
import { PopoverButton } from '../../../components/ui/PopoverButton.tsx'

interface ProductsBulkBarProps {
  /** Products on the page being shown. */
  pageCount: number
  /** Ticked products on this page. */
  selectedCount: number
  onEditPage: () => void
  onEditSelected: () => void
  onClearSelection: () => void
  /** The menu was opened: warm the products' details so the editor opens populated. */
  onPrepare: () => void
}

const ITEM =
  'hover:bg-accent-tint/60 flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg border-none bg-transparent px-3 py-2.5 text-left transition-colors disabled:pointer-events-none disabled:opacity-50'

const plural = (count: number) => `${count} product${count === 1 ? '' : 's'}`

/**
 * The strip above the list: how many rows are ticked, and the "Edit in bulk"
 * menu — edit every product on this page, or just the ticked ones.
 */
export function ProductsBulkBar({
  pageCount,
  selectedCount,
  onEditPage,
  onEditSelected,
  onClearSelection,
  onPrepare,
}: ProductsBulkBarProps) {
  return (
    <div className="border-border bg-bg flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-2.5">
      <p className="text-text-muted text-[0.82rem]">
        {selectedCount > 0 ? (
          <>
            <span className="text-text font-semibold">{selectedCount} selected</span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-accent ml-3 cursor-pointer border-none bg-transparent p-0 text-[0.82rem] font-semibold hover:underline"
            >
              Clear selection
            </button>
          </>
        ) : (
          'Tick products to edit several at once.'
        )}
      </p>

      <div className="ml-auto">
        <PopoverButton
          label="Edit in bulk"
          icon={PencilIcon}
          align="right"
          tone={selectedCount > 0 ? 'primary' : 'neutral'}
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
      </div>
    </div>
  )
}
