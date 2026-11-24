import { useState } from 'react'
import { EyeIcon, EyeOffIcon, LockIcon } from '../../../components/ui/icons.tsx'

const INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint placeholder:text-text-muted/70 h-10 w-full min-w-0 rounded-lg border pr-10 pl-9 text-[0.88rem] font-medium transition-colors outline-none focus:outline-2 aria-[invalid=true]:border-danger disabled:opacity-60'

interface PasswordInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  /** Spoken name of the box when it has no visible `<label htmlFor>`. */
  ariaLabel?: string
  error?: string
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * A password box with a lock icon and a show / hide button. `autoComplete="new-password"` so the
 * browser offers to generate one and never fills in the staff member's own saved password.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  ariaLabel,
  error,
  disabled,
  autoFocus,
}: PasswordInputProps) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <LockIcon
        width={16}
        height={16}
        className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
      />
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        autoComplete="new-password"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={256}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? true : undefined}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT}
      />
      <button
        type="button"
        onClick={() => setShown((current) => !current)}
        disabled={disabled}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="text-text-muted hover:text-text absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent transition-colors disabled:pointer-events-none"
      >
        {shown ? (
          <EyeOffIcon width={16} height={16} />
        ) : (
          <EyeIcon width={16} height={16} />
        )}
      </button>
    </div>
  )
}
