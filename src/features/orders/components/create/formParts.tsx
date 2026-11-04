import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { XIcon } from '../../../../components/ui/icons.tsx'
import { splitChips } from '../../utils/orderDraft.ts'

// The Add product form's look, so the two "Add" pages read alike.

export const CARD = 'border-border bg-bg min-w-0 rounded-2xl border'
export const FIELD_LABEL = 'text-text text-[0.82rem] font-semibold'
export const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint placeholder:text-text-muted/70 h-10 w-full min-w-0 rounded-lg border px-3 text-[0.88rem] font-medium transition-colors outline-none focus:outline-2 aria-[invalid=true]:border-danger disabled:opacity-60'
export const FIELD_TEXTAREA =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint placeholder:text-text-muted/70 min-h-24 w-full min-w-0 resize-y rounded-lg border px-3 py-2.5 text-[0.88rem] leading-relaxed font-medium transition-colors outline-none focus:outline-2 aria-[invalid=true]:border-danger'
export const TEXT_BUTTON =
  'text-accent hover:text-accent-hover inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
export const ICON_BUTTON =
  'text-text-muted hover:text-danger hover:bg-danger-bg inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent transition-colors'
export const CHIP =
  'border-border-strong bg-accent-tint/50 text-text inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-[0.8rem] font-medium'

/**
 * A card of the form: a soft box with a thin border, its heading inside at the top (or, with
 * `headingAbove`, above it as the Add product form puts "Price" and "Variants"). `action` sits at
 * the heading's right edge; `flush` drops the padding for rows that run edge to edge.
 */
export function FormCard({
  title,
  headingAbove = false,
  flush = false,
  action,
  children,
}: {
  title: string
  headingAbove?: boolean
  flush?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  const heading = (
    <div
      className={`flex items-center justify-between gap-3 ${flush && !headingAbove ? 'px-4 pt-4 sm:px-5 sm:pt-5' : ''}`}
    >
      <h4 className="text-[0.95rem] font-semibold">{title}</h4>
      {action}
    </div>
  )
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2.5">
      {headingAbove && heading}
      <div
        className={`${CARD} flex flex-col ${flush ? 'gap-3 overflow-hidden' : 'gap-4 p-4 sm:p-5'}`}
      >
        {!headingAbove && heading}
        {children}
      </div>
    </section>
  )
}

/** A labelled field with its hint and its problem. */
export function Field({
  id,
  label,
  error,
  hint,
  optional = false,
  children,
}: {
  id: string
  label: ReactNode
  error?: string
  hint?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
        {optional && <span className="text-text-muted font-normal"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-text-muted text-[0.76rem]">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger text-[0.78rem]">
          {error}
        </p>
      )}
    </div>
  )
}

/** A text box wired to a `Field`'s id and problem. */
export function TextInput({
  id,
  value,
  onChange,
  error,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete = 'off',
  maxLength,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  type?: 'text' | 'email' | 'tel'
  inputMode?: 'decimal' | 'numeric' | 'email' | 'tel'
  autoComplete?: string
  maxLength?: number
}) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      onChange={(event) => onChange(event.target.value)}
      className={FIELD_INPUT}
    />
  )
}

/** A box for an amount, with the currency's symbol in front ("£ 0.00"). */
export function MoneyInput({
  id,
  value,
  onChange,
  symbol,
  error,
  placeholder = '0.00',
  label,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  symbol: string
  error?: string
  placeholder?: string
  /** For a box with no visible label of its own (a table cell). */
  label?: string
}) {
  return (
    <div className="relative min-w-0">
      {symbol && (
        <span
          aria-hidden="true"
          className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[0.88rem] font-medium"
        >
          {symbol}
        </span>
      )}
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_INPUT} ${symbol ? 'pl-8' : ''}`}
      />
    </div>
  )
}

/** A small checkbox with its label. */
export function CheckField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 text-[0.82rem] font-medium"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-accent h-4 w-4 shrink-0 cursor-pointer"
      />
      {label}
    </label>
  )
}

/**
 * Chips with a box to add more: Enter or a comma adds what was typed (pasting "a, b" adds two;
 * blanks and repeats are ignored), each chip has a ✕, Backspace in the empty box removes the
 * last one, and leaving the box adds what is left in it.
 */
export function ChipsInput({
  id,
  values,
  onChange,
  placeholder,
  error,
  removeLabel,
}: {
  id: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
  error?: string
  /** "Remove tag" / "Remove code" — the ✕'s name, followed by the value. */
  removeLabel: string
}) {
  const [text, setText] = useState('')

  function commit(raw: string) {
    const added = splitChips(raw, values)
    if (added.length > 0) onChange([...values, ...added])
    setText('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(text)
    } else if (event.key === 'Backspace' && !text && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const next = event.target.value
          if (/[,\n]/.test(next)) commit(next)
          else setText(next)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => text.trim() && commit(text)}
        className={FIELD_INPUT}
      />
      {values.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {values.map((value) => (
            <li key={value} className={CHIP}>
              <span className="truncate">{value}</span>
              <button
                type="button"
                aria-label={`${removeLabel} ${value}`}
                onClick={() =>
                  onChange(values.filter((candidate) => candidate !== value))
                }
                className="text-text-muted hover:text-danger inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent"
              >
                <XIcon width={12} height={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
