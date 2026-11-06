import { useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react'
import {
  ImageIcon,
  SearchIcon,
  XIcon,
  type IconProps,
} from '../../../../components/ui/icons.tsx'
import { safeUrl } from '../../../../lib/safeUrl.ts'
import { splitChips } from '../../utils/orderDraft.ts'

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
const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50'
export const PRIMARY_BUTTON = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`
export const SECONDARY_BUTTON = `${BUTTON} border-border bg-bg text-text hover:border-accent`
export const CHIP =
  'border-border-strong bg-accent-tint/50 text-text inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-[0.8rem] font-medium'

/** A section's icon, in a tinted tile. */
export function IconTile({
  icon: Icon,
  large = false,
}: {
  icon: ComponentType<IconProps>
  large?: boolean
}) {
  const size = large ? 26 : 20
  return (
    <span
      className={`bg-accent-tint text-accent border-border-strong flex shrink-0 items-center justify-center rounded-lg border ${large ? 'h-14 w-14' : 'h-11 w-11'}`}
    >
      <Icon width={size} height={size} />
    </span>
  )
}

/**
 * A section of the form: its icon, title and one-line description, then what it holds. `action`
 * sits beside the title, taking the rest of the row (Customer's search box).
 */
export function OrderSection({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: ComponentType<IconProps>
  title: string
  subtitle: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <section aria-label={title} className={`${CARD} flex flex-col gap-4 p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <IconTile icon={icon} />
          <div className="flex flex-col">
            <h3 className="text-[1rem] font-semibold">{title}</h3>
            <p className="text-text-muted m-0 text-[0.8rem]">{subtitle}</p>
          </div>
        </div>
        {action && <div className="min-w-0 flex-1 basis-80">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/**
 * A search box whose results drop down over the page, as `children`. They show while the box is
 * in use and holds text; leaving it or Escape puts them away. The pointer pressing inside the
 * list keeps the focus in the box, so a result can be pressed in every browser.
 */
export function SearchDropdown({
  id,
  label,
  value,
  placeholder,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const showing = open && value.trim() !== ''
  return (
    <div
      className="relative min-w-0 flex-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && showing) {
          event.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon
        width={16}
        height={16}
        aria-hidden="true"
        className="text-text-muted pointer-events-none absolute top-3 left-3"
      />
      <input
        id={id}
        type="search"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setOpen(true)
          onChange(event.target.value)
        }}
        className={`${FIELD_INPUT} pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear: ${label}`}
          onClick={() => onChange('')}
          className="text-text-muted hover:text-text absolute top-2.5 right-2.5 inline-flex cursor-pointer border-none bg-transparent p-0.5"
        >
          <XIcon width={16} height={16} />
        </button>
      )}
      {showing && (
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="border-border bg-bg absolute inset-x-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-xl border shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** A product's small picture; an empty tile when there is none. */
export function Thumb({ url, alt }: { url: string | null | undefined; alt: string }) {
  const src = safeUrl(url)
  return (
    <span className="border-border bg-surface flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {src ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageIcon width={16} height={16} className="text-text-muted" />
      )}
    </span>
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
