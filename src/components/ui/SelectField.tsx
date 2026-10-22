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
  /** A smaller control (shorter, smaller text) for a dense grid of filters. */
  compact?: boolean
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
  compact = false,
}: SelectFieldProps) {
  return (
    <div
      className={
        inline
          ? 'flex items-center gap-2'
          : `flex min-w-0 flex-col ${compact ? 'gap-1' : 'gap-1.5'}`
      }
    >
      <label
        htmlFor={id}
        className={`text-text flex shrink-0 items-center gap-1.5 font-semibold ${
          compact ? 'text-[0.72rem]' : 'text-[0.82rem]'
        } ${hideLabel ? 'sr-only' : ''}`}
      >
        {Icon && (
          <Icon
            width={compact ? 14 : 16}
            height={compact ? 14 : 16}
            className="text-text-muted"
          />
        )}
        {label}
        {inline && ':'}
      </label>
      <div className="relative min-w-0 flex-1">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`border-border bg-bg text-text focus:border-accent focus:outline-accent-tint w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border font-medium transition-colors outline-none focus:outline-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            compact ? 'h-8 pr-7 pl-2.5 text-[0.76rem]' : 'h-10 pr-9 pl-3 text-[0.85rem]'
          }`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          width={compact ? 14 : 16}
          height={compact ? 14 : 16}
          className={`text-text-muted pointer-events-none absolute top-1/2 -translate-y-1/2 ${
            compact ? 'right-2' : 'right-3'
          }`}
        />
      </div>
    </div>
  )
}
