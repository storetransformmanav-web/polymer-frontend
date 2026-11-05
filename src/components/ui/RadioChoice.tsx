import type { ReactNode } from 'react'

/** One radio of a group: the circle, its label and an optional hint. */
export function RadioChoice({
  name,
  value,
  checked,
  disabled,
  onSelect,
  children,
  hint,
}: {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onSelect: () => void
  children: ReactNode
  /** A smaller line under the label. */
  hint?: string
}) {
  return (
    <label
      className={`flex items-start gap-3 py-1 text-[0.92rem] ${
        disabled ? 'text-text-muted/60 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="accent-accent mt-[0.2rem] h-4 w-4 shrink-0 cursor-[inherit]"
      />
      <span className="flex flex-col">
        <span>{children}</span>
        {hint && <span className="text-text-muted text-[0.78rem]">{hint}</span>}
      </span>
    </label>
  )
}
