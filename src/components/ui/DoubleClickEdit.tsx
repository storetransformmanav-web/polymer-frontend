import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { IconAction } from './IconAction.tsx'
import { CheckIcon, EyeIcon, EyeOffIcon, PencilIcon, XIcon } from './icons.tsx'
import { ROW_ACTION, ROW_ACTION_ICON } from './rowActions.ts'

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
  rowActionIcon = false,
  busy = false,
  autoWidth = false,
  multiline = false,
  secret = false,
  inputType,
  showActions = false,
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
  /** With `showIcon`: the pencil is drawn as a list's row action (the same size and hover). */
  rowActionIcon?: boolean
  /** Something is happening to the value (waiting for the question, saving): shown dimmed. */
  busy?: boolean
  /**
   * The box is as wide as what is typed — it grows with long text, with no upper limit (a small
   * minimum keeps a short number easy to hit) — instead of filling its place.
   */
  autoWidth?: boolean
  /**
   * A text area (four lines, taller by dragging) instead of a one-line box, for text that can run
   * long: Enter starts a new line, **Ctrl + Enter** (⌘ + Enter) or leaving the box keeps it,
   * Escape puts the old text back, and a counter shows how much of `maxLength` is used.
   */
  multiline?: boolean
  /** What is typed is hidden (dots), for a PIN or a password. */
  secret?: boolean
  /** A date, time or number box instead of a plain text one (date and time open their picker on a click). */
  inputType?: 'date' | 'time' | 'number'
  /** ✓ Save and ✕ Discard buttons beside the box while it is open (as on the product page's edits). */
  showActions?: boolean
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [problem, setProblem] = useState<string | null>(null)
  // A secret (a PIN) is hidden while it is typed, until the view icon is pressed.
  const [reveal, setReveal] = useState(false)
  // Escape and Enter take the box away, and some browsers then report a blur: only settle once.
  const settled = useRef(false)

  function start() {
    if (busy) return
    settled.current = false
    setDraft(value)
    setProblem(null)
    setReveal(false)
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

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === 'Enter') {
      // In a text area Enter is a new line; only Ctrl / ⌘ + Enter keeps the text.
      if (multiline && !(event.ctrlKey || event.metaKey)) return
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
      <span
        className={`${autoWidth ? 'inline-flex' : 'flex min-w-0'} flex-col gap-1 ${
          autoWidth && align === 'right'
            ? 'items-end'
            : autoWidth && align === 'center'
              ? 'items-center'
              : ''
        } ${className}`}
      >
        {multiline ? (
          <>
            <textarea
              autoFocus
              aria-label={label}
              aria-invalid={problem ? true : undefined}
              autoComplete="off"
              spellCheck
              rows={4}
              value={draft}
              maxLength={maxLength}
              placeholder={placeholder}
              onFocus={(event) => {
                // Put the cursor at the end (long text is edited, not replaced).
                const end = event.currentTarget.value.length
                event.currentTarget.setSelectionRange(end, end)
              }}
              onChange={(event) => {
                setDraft(event.target.value)
                setProblem(null)
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => finish(true)}
              className={`border-accent text-text focus:outline-accent-tint aria-[invalid=true]:border-danger min-h-24 w-full min-w-0 resize-y rounded-lg border px-2 py-1.5 text-[0.8rem] leading-snug font-medium outline-none focus:outline-2 ${
                highlighted ? 'bg-accent-tint/40' : 'bg-bg'
              }`}
            />
            <span className="text-text-muted flex flex-wrap items-center justify-between gap-x-3 text-[0.7rem] font-normal">
              <span>Ctrl + Enter to save · Esc to cancel</span>
              {maxLength !== undefined && (
                <span aria-live="off" className="tabular-nums">
                  {draft.length} / {maxLength}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">
            <input
              autoFocus
              aria-label={label}
              aria-invalid={problem ? true : undefined}
              type={
                secret && !reveal ? 'password' : secret ? 'text' : (inputType ?? 'text')
              }
              onClick={
                inputType === 'date' || inputType === 'time'
                  ? (event) => {
                      try {
                        event.currentTarget.showPicker()
                      } catch {
                        // No picker here: the box still works by typing.
                      }
                    }
                  : undefined
              }
              autoComplete={secret ? 'new-password' : 'off'}
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
              // One `ch` per character typed, plus one spare and the padding and border.
              style={
                autoWidth
                  ? { width: `calc(${Math.max(draft.length, 1) + 1}ch + 1.25rem)` }
                  : undefined
              }
              className={`border-accent text-text focus:outline-accent-tint aria-[invalid=true]:border-danger h-8 ${
                autoWidth ? 'max-w-none min-w-16' : 'w-full min-w-0'
              } rounded-lg border px-2 text-[0.8rem] font-medium outline-none focus:outline-2 ${
                highlighted ? 'bg-accent-tint/40' : 'bg-bg'
              } ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}
            />
            {secret && (
              <button
                type="button"
                aria-label={`${reveal ? 'Hide' : 'Show'} ${label}`}
                aria-pressed={reveal}
                // Pressing it must not blur the box first (a blur would keep the change).
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setReveal((value) => !value)}
                className="text-text-muted hover:text-accent inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent transition-colors"
              >
                {reveal ? (
                  <EyeOffIcon width={16} height={16} />
                ) : (
                  <EyeIcon width={16} height={16} />
                )}
              </button>
            )}
            {showActions && (
              // Pressing a button must not blur the box first (a blur would keep the change).
              <span
                className="flex shrink-0 items-center gap-1"
                onMouseDown={(event) => event.preventDefault()}
              >
                <IconAction
                  label="Save"
                  accessibleLabel={`Save ${label}`}
                  icon={CheckIcon}
                  tone="primary"
                  onClick={() => finish(true)}
                />
                <IconAction
                  label="Discard"
                  accessibleLabel={`Discard ${label}`}
                  icon={XIcon}
                  onClick={() => finish(false)}
                />
              </span>
            )}
          </span>
        )}
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
        showIcon ? 'inline-flex items-center gap-1.5' : ''
      } ${place} ${busy ? 'opacity-60' : ''} ${className}`}
    >
      {display}
      {showIcon && (
        <span
          data-edit-icon
          aria-hidden="true"
          className={
            rowActionIcon
              ? // `-my-1`: the 28px square doesn't make its line any taller.
                `${ROW_ACTION} -my-1 shrink-0`
              : 'text-text-muted hover:text-accent inline-flex shrink-0 cursor-pointer opacity-70 transition-colors hover:opacity-100'
          }
        >
          <PencilIcon
            width={rowActionIcon ? ROW_ACTION_ICON : 12}
            height={rowActionIcon ? ROW_ACTION_ICON : 12}
          />
        </span>
      )}
    </button>
  )
}
