import {
  useEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'

export interface OtpInputProps {
  /** Digits entered so far (always contiguous from the first box). */
  value: string
  onChange: (value: string) => void
  /** Called once, as soon as the last box is filled. */
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  invalid?: boolean
  label?: string
}

const BOX =
  'border-border bg-surface text-text focus:border-accent focus:outline-accent-tint h-12 w-full min-w-0 rounded-lg border text-center text-xl font-semibold transition-colors outline-none focus:outline-2 disabled:opacity-60'

/**
 * Segmented one-time-code input: one box per digit with auto-advance,
 * backspace navigation, paste, and browser/SMS autofill. Focuses the first
 * empty box on mount and whenever it's cleared or re-enabled, so a retry
 * after a wrong code needs no extra click.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  label = 'One-time code',
}: OtpInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, index) => value[index] ?? '')

  function focusBox(index: number) {
    boxes.current[Math.max(0, Math.min(index, length - 1))]?.focus()
  }

  // Focus follows the value, after it has rendered: an empty input takes
  // focus (mount, reset after a wrong code, re-enable); otherwise, if the
  // user is inside the group, focus moves to the next box to fill. Doing
  // this after render matters — each box's onFocus guard reads `value`.
  useEffect(() => {
    if (disabled) return
    const inGroup = boxes.current.some((box) => box === document.activeElement)
    if (value.length === 0 || inGroup) {
      boxes.current[Math.min(value.length, length - 1)]?.focus()
    }
  }, [value, disabled, length])

  function commit(next: string) {
    onChange(next)
    if (next.length === length) {
      ;(document.activeElement as HTMLElement | null)?.blur()
      onComplete?.(next)
    }
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    let incoming = event.target.value.replace(/\D/g, '')

    if (!incoming) {
      // The digit in this box was deleted: close the gap.
      onChange(value.slice(0, index) + value.slice(index + 1))
      return
    }

    // Typing over an already-filled box yields "<old><new>" — keep the new one.
    if (digits[index] && incoming.length === 2) {
      incoming = incoming[0] === digits[index] ? incoming[1] : incoming[0]
    }

    // One typed digit replaces just this box; multiple (autofill) overwrite from here.
    const tail = incoming.length === 1 ? value.slice(index + 1) : ''
    commit((value.slice(0, index) + incoming + tail).slice(0, length))
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      onChange(value.slice(0, index - 1))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusBox(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusBox(Math.min(index + 1, value.length))
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pasted) commit(pasted)
  }

  return (
    <div role="group" aria-label={label} className="flex gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          value={digit}
          disabled={disabled}
          className={`${BOX} ${invalid ? 'border-danger' : ''}`}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => {
            // Never land past the first empty box, so the value stays contiguous.
            if (index > value.length) focusBox(value.length)
            else event.target.select()
          }}
        />
      ))}
    </div>
  )
}
