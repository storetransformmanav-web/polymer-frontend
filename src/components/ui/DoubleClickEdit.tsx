import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { PencilIcon } from './icons.tsx'

/**
 * A value you change where it is shown: **double-click it** (or focus it and press Enter) and it
 * turns into a box already holding the value, selected; Enter or leaving the box keeps what was
 * typed, Escape puts the old value back. Nothing is saved here — a changed value is handed to
 * `onCommit`, and the caller decides what to do (ask "are you sure?", then save). A value that
 * `validate` refuses keeps the box open with the reason under it.
 */
export function DoubleClickEdit({
  value,
  display,
  label,
  onCommit,
  validate,
  inputMode,
  maxLength,
  placeholder,
  align = 'left',
  highlighted = false,
  showIcon = false,
  busy = false,
  className = '',
}: {
  /** The value as saved. */
  value: string
  /** How it is shown while it is not being edited. */
  display: ReactNode
  /** The box's accessible name ("Alt text of image 2"). */
  label: string
  /** Called with the trimmed new value, only when it differs from `value`. */
  onCommit: (next: string) => void
  /** A reason to refuse a new value, or null when it is fine. */
  validate?: (next: string) => string | null
  inputMode?: 'numeric' | 'decimal' | 'text'
  maxLength?: number
  placeholder?: string
  align?: 'left' | 'right' | 'center'
  /** Drawn as a tinted chip, so it reads as something to edit (the alt text under a picture). */
  highlighted?: boolean
  /** A small pencil beside the value: one click on it starts the edit, like the double-click. */
  showIcon?: boolean
  /** Something is happening to the value (waiting for the question, saving): shown dimmed. */
  busy?: boolean
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [problem, setProblem] = useState<string | null>(null)
  // Escape and Enter take the box away, and some browsers then report a blur: only settle once.
  const settled = useRef(false)

  function start() {
    if (busy) return
    settled.current = false
    setDraft(value)
    setProblem(null)
    setEditing(true)
  }

  function finish(keep: boolean) {
    if (settled.current) return
    if (!keep) {
      settled.current = true
      setEditing(false)
      setProblem(null)
      return
    }
    const next = draft.trim()
    if (next === value.trim()) {
      settled.current = true
      setEditing(false)
      return
    }
    const refused = validate?.(next) ?? null
    if (refused) {
      setProblem(refused)
      return
    }
    settled.current = true
    setEditing(false)
    onCommit(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      finish(true)
    } else if (event.key === 'Escape') {
      // Only this edit stops; a section around it must not take Escape as "discard everything".
      event.preventDefault()
      event.stopPropagation()
      finish(false)
    }
  }

  if (editing) {
    return (
      <span className={`flex min-w-0 flex-col gap-1 ${className}`}>
        <input
          autoFocus
          aria-label={label}
          aria-invalid={problem ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          value={draft}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setDraft(event.target.value)
            setProblem(null)
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => finish(true)}
          className={`border-accent text-text focus:outline-accent-tint aria-[invalid=true]:border-danger h-8 w-full min-w-0 rounded-lg border px-2 text-[0.8rem] font-medium outline-none focus:outline-2 ${
            highlighted ? 'bg-accent-tint/40' : 'bg-bg'
          } ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}
        />
        {problem && (
          <span role="alert" className="text-danger text-[0.72rem] font-normal">
            {problem}
          </span>
        )}
      </span>
    )
  }

  const tone = highlighted
    ? 'bg-accent-tint/50 hover:bg-accent-tint px-2 py-1'
    : '-mx-1 bg-transparent px-1 py-0.5 hover:bg-accent-tint/60'
  const place =
    align === 'right'
      ? 'text-right justify-end'
      : align === 'center'
        ? 'text-center justify-center'
        : 'text-left'

  return (
    <button
      type="button"
      title="Double-click to edit"
      onDoubleClick={start}
      // A keyboard "click" (Enter or Space on the focused value), or a click on the pencil,
      // starts the edit too.
      onClick={(event) => {
        if (event.detail === 0 || (event.target as Element).closest('[data-edit-icon]')) {
          start()
        }
      }}
      className={`focus-visible:outline-accent min-w-0 cursor-text rounded border-none transition-colors focus-visible:outline-2 ${tone} ${
        showIcon ? 'inline-flex items-start gap-1.5' : ''
      } ${place} ${busy ? 'opacity-60' : ''} ${className}`}
    >
      {display}
      {showIcon && (
        <span
          data-edit-icon
          aria-hidden="true"
          className="text-text-muted hover:text-accent mt-0.5 inline-flex shrink-0 cursor-pointer opacity-70 transition-colors hover:opacity-100"
        >
          <PencilIcon width={12} height={12} />
        </span>
      )}
    </button>
  )
}
