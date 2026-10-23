import type { ComponentType } from 'react'
import { ChevronDownIcon, type IconProps } from './icons.tsx'

/**
 * Where the browser supports customisable selects (`appearance: base-select`), the open
 * list is themed: it is the app's card (border, radius, shadow) and an option under the
 * pointer gets the same tint as a hovered table row (`bg-accent-tint/60`); the chosen
 * one is a little stronger. Elsewhere the native list is used. It stays a real
 * `<select>`, so keyboard, screen readers and phones behave as before.
 */
export const SELECT_THEME = [
  'supports-[appearance:base-select]:[appearance:base-select]',
  'supports-[appearance:base-select]:flex supports-[appearance:base-select]:items-center',
  '[&::picker-icon]:hidden',
  '[&::picker(select)]:[appearance:base-select]',
  '[&::picker(select)]:mt-1 [&::picker(select)]:rounded-xl [&::picker(select)]:border',
  '[&::picker(select)]:border-border [&::picker(select)]:bg-bg [&::picker(select)]:p-1.5',
  '[&::picker(select)]:shadow-lg',
  // About ten options tall, then it scrolls — a long list (tags) never runs off the page.
  '[&::picker(select)]:max-h-80',
  '[&_option]:cursor-pointer [&_option]:rounded-lg [&_option]:px-2.5 [&_option]:py-1.5',
  '[&_option]:text-text [&_option]:transition-colors',
  '[&_option:hover]:bg-accent-tint/60 [&_option:focus-visible]:bg-accent-tint/60',
  '[&_option:checked]:bg-accent-tint [&_option:checked]:font-semibold',
].join(' ')

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
          className={`border-border bg-bg text-text focus:border-accent focus:outline-accent-tint w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border font-medium transition-colors outline-none focus:outline-2 disabled:cursor-not-allowed disabled:opacity-60 ${SELECT_THEME} ${
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
