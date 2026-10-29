import { XIcon } from '../../../components/ui/icons.tsx'
import type { PickedItem } from '../utils/lockDraft.ts'

/** What has been ticked so far — chips with a ✕ and a Clear, so a choice can be undone from any page or search. */
export function PickedChips({
  noun,
  items,
  onRemove,
  onClear,
}: {
  noun: string
  items: readonly PickedItem[]
  onRemove: (id: string) => void
  onClear: () => void
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.82rem] font-semibold" aria-live="polite">
          {items.length.toLocaleString('en-GB')} {noun}
          {items.length === 1 ? '' : 's'} selected
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-text-muted hover:text-danger cursor-pointer border-none bg-transparent text-[0.78rem] font-semibold"
        >
          Clear selection
        </button>
      </div>
      <ul
        aria-label={`Selected ${noun}s`}
        className="flex max-h-28 flex-wrap gap-1.5 overflow-auto"
      >
        {items.map((item) => (
          <li
            key={item.id}
            className="bg-accent-tint text-accent inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-[0.75rem] font-semibold"
          >
            <span className="max-w-52 truncate" title={item.label}>
              {item.label}
            </span>
            <button
              type="button"
              aria-label={`Remove ${item.label}`}
              onClick={() => onRemove(item.id)}
              className="hover:bg-accent/15 inline-flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-current"
            >
              <XIcon width={11} height={11} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
