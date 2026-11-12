/**
 * The sort arrows: an up arrow and a down arrow side by side. Sorted ascending lights the up arrow,
 * sorted descending lights the down one (the other fades), and an unsorted column shows both
 * muted — so which way the list runs can be read at a glance.
 */
function SortArrows({ direction }: { direction: 'asc' | 'desc' | null }) {
  const lit = { strokeWidth: 2.4, opacity: 1 }
  const dim = { strokeWidth: 1.6, opacity: direction === null ? 0.7 : 0.28 }
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <g {...(direction === 'asc' ? lit : dim)}>
        <path d="M6.5 16.5v-13M3.5 6.5l3-3 3 3" />
      </g>
      <g {...(direction === 'desc' ? lit : dim)}>
        <path d="M13.5 3.5v13M10.5 13.5l3 3 3-3" />
      </g>
    </svg>
  )
}

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
 * click again to flip to descending and back. Two arrows show it can be sorted; the active
 * column lights the arrow of its direction (up = ascending, down = descending) in the accent colour. Put `aria-sort` on the `<th>`
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
      <span className={active ? '' : 'text-text-muted'}>
        <SortArrows direction={active ? order : null} />
      </span>
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
