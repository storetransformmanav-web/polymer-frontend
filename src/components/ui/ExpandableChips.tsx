import { useState } from 'react'

interface ExpandableChipsProps {
  values: string[]
  /** How many chips show before the "+N" button. */
  limit?: number
  /** Tailwind max-width class for one chip. */
  chipWidth?: string
  /** Centre the chips (a centred column). */
  centered?: boolean
}

const CHIP =
  'bg-surface border-border truncate rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold'

const TOGGLE =
  'text-text-muted hover:text-accent hover:bg-accent-tint focus-visible:outline-accent cursor-pointer rounded-full px-1.5 py-0.5 text-[0.7rem] font-semibold transition-colors focus-visible:outline-2'

/**
 * A row of chips for a table cell: the first few, then a "+N" button. Clicking it shows every
 * remaining chip (wrapping inside the cell); "Show less" folds them again. Generic — it only
 * knows a list of words.
 */
export function ExpandableChips({
  values,
  limit = 2,
  chipWidth = 'max-w-32',
  centered = false,
}: ExpandableChipsProps) {
  const [open, setOpen] = useState(false)
  const hidden = values.length - limit
  const shown = open || hidden <= 0 ? values : values.slice(0, limit)

  return (
    <span
      className={`inline-flex items-center gap-1 ${
        open ? 'flex-wrap whitespace-normal' : ''
      } ${centered ? 'justify-center' : ''}`}
    >
      {shown.map((value) => (
        <span key={value} className={`${CHIP} ${chipWidth}`} title={value}>
          {value}
        </span>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          aria-expanded={open}
          title={
            open ? 'Show fewer' : `Show ${hidden} more: ${values.slice(limit).join(', ')}`
          }
          onClick={() => setOpen((value) => !value)}
          className={TOGGLE}
        >
          {open ? 'Show less' : `+${hidden}`}
        </button>
      )}
    </span>
  )
}
