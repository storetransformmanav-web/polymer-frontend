import type { ComponentType } from 'react'
import { ChevronDownIcon, type IconProps } from './icons.tsx'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldProps {
  id: string
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  icon?: ComponentType<IconProps>
  /** Label to the left of the control instead of above it. */
  inline?: boolean
  /** Keep the label for screen readers only (when context makes it obvious). */
  hideLabel?: boolean
  disabled?: boolean
}

/**
 * Labelled native `<select>` with a custom chevron. Native keeps it fast,
 * accessible and mobile-friendly; only the chrome is styled.
 */
export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  icon: Icon,
  inline = false,
  hideLabel = false,
  disabled = false,
}: SelectFieldProps) {
  return (
    <div className={inline ? 'flex items-center gap-2' : 'flex min-w-0 flex-col gap-1.5'}>
      <label
        htmlFor={id}
        className={`text-text flex shrink-0 items-center gap-1.5 text-[0.82rem] font-semibold ${
          hideLabel ? 'sr-only' : ''
        }`}
      >
        {Icon && <Icon width={16} height={16} className="text-text-muted" />}
        {label}
        {inline && ':'}
      </label>
      <div className="relative min-w-0 flex-1">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-10 w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border pr-9 pl-3 text-[0.85rem] font-medium transition-colors outline-none focus:outline-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          width={16}
          height={16}
          className="text-text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        />
      </div>
    </div>
  )
}
