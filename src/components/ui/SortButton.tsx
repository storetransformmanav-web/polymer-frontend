import { ArrowUpDownIcon, ChevronDownIcon } from './icons.tsx'

interface SortButtonProps {
  /** The column's name, which is also what the button says. */
  label: string
  /** This column is the one the list is sorted by. */
  active: boolean
  /** The direction when `active`. */
  order: 'asc' | 'desc'
  onClick: () => void
}

/**
 * The label of a sortable table header, as a button: click to sort by the column (ascending),
 * click again to flip to descending and back. An up/down arrow shows it can be sorted; the
 * active column shows the direction in the accent colour. Put `aria-sort` on the `<th>`
 * (`ariaSort`) so screen readers hear the state too.
 */
export function SortButton({ label, active, order, onClick }: SortButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        active
          ? `Sorted ${order === 'asc' ? 'ascending' : 'descending'} — click to reverse`
          : `Sort by ${label.toLowerCase()}`
      }
      className={`focus-visible:outline-accent inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 font-[inherit] tracking-[inherit] uppercase transition-colors focus-visible:outline-2 ${
        active ? 'text-accent' : 'text-text hover:text-accent'
      }`}
    >
      {label}
      {active ? (
        <ChevronDownIcon
          width={14}
          height={14}
          aria-hidden="true"
          className={`transition-transform ${order === 'asc' ? 'rotate-180' : ''}`}
        />
      ) : (
        <ArrowUpDownIcon
          width={13}
          height={13}
          aria-hidden="true"
          className="text-text-muted"
        />
      )}
    </button>
  )
}

/** The `aria-sort` value for a header: only the active column has one. */
export function ariaSort(
  active: boolean,
  order: 'asc' | 'desc',
): 'ascending' | 'descending' | undefined {
  if (!active) return undefined
  return order === 'asc' ? 'ascending' : 'descending'
}
