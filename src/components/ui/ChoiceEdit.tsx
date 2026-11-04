import { useRef, useState, type ReactNode } from 'react'
import { PencilIcon } from './icons.tsx'

export interface ChoiceOption {
  value: string
  label: string
}

/**
 * A value you change where it is shown, by choosing from a short list: **double-click it** (or
 * focus it and press Enter, or click the pencil) and it turns into a dropdown with the choices
 * (Yes / No, Enabled / Disabled…); choosing a different one hands it to `onCommit`, Escape or
 * leaving the dropdown puts the old value back. Nothing is saved here — the caller asks "are you
 * sure?" and saves. The sibling of `DoubleClickEdit`, which does the same with a typed value.
 */
export function ChoiceEdit({
  value,
  options,
  display,
  label,
  onCommit,
  busy = false,
}: {
  /** The value as saved. */
  value: string
  options: ChoiceOption[]
  /** How it is shown while it is not being edited. */
  display: ReactNode
  /** The dropdown's accessible name ("Hidden from lists"). */
  label: string
  /** Called with the chosen value, only when it differs from `value`. */
  onCommit: (next: string) => void
  /** Something is happening to the value (waiting for the question, saving): shown dimmed. */
  busy?: boolean
}) {
  const [editing, setEditing] = useState(false)
  // Escape, a choice and a blur can all end the edit: only settle once.
  const settled = useRef(false)

  function start() {
    if (busy) return
    settled.current = false
    setEditing(true)
  }

  function finish(next: string | null) {
    if (settled.current) return
    settled.current = true
    setEditing(false)
    if (next !== null && next !== value) onCommit(next)
  }

  if (editing) {
    return (
      <select
        autoFocus
        aria-label={label}
        value={value}
        onChange={(event) => finish(event.target.value)}
        onBlur={() => finish(null)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            // Only this edit stops; a section around it must not take Escape as "discard everything".
            event.preventDefault()
            event.stopPropagation()
            finish(null)
          }
        }}
        className="border-accent bg-bg text-text focus:outline-accent-tint h-8 min-w-28 cursor-pointer rounded-lg border px-2 text-[0.8rem] font-medium outline-none focus:outline-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <button
      type="button"
      title="Double-click to change"
      aria-label={`${label}: ${options.find((option) => option.value === value)?.label ?? value}`}
      onDoubleClick={start}
      // A keyboard "click" (Enter or Space on the focused value), or a click on the pencil.
      onClick={(event) => {
        if (event.detail === 0 || (event.target as Element).closest('[data-edit-icon]')) {
          start()
        }
      }}
      className={`focus-visible:outline-accent hover:bg-accent-tint/60 -mx-1 inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded border-none bg-transparent px-1 py-0.5 text-left transition-colors focus-visible:outline-2 ${busy ? 'opacity-60' : ''}`}
    >
      {display}
      <span
        data-edit-icon
        aria-hidden="true"
        className="text-text-muted hover:text-accent inline-flex shrink-0 opacity-70 transition-colors hover:opacity-100"
      >
        <PencilIcon width={12} height={12} />
      </span>
    </button>
  )
}
