import { useState } from 'react'
import { OtpInput } from './OtpInput.tsx'
import { SelectField } from './SelectField.tsx'

const LENGTH_OPTIONS = [
  { value: '', label: 'Choose 4 or 6 digits' },
  { value: '4', label: '4 digits' },
  { value: '6', label: '6 digits' },
]

interface PinFieldsProps {
  /** Makes the ids of the dropdown and the error unique. */
  id: string
  /** How many digits the PIN has; 0 until one is chosen. */
  length: number
  /** Another length was chosen: the caller empties what was typed. */
  onLengthChange: (length: number) => void
  pin: string
  onPinChange: (pin: string) => void
  /** With `onConfirmChange`: a second row of boxes to type the PIN again. */
  confirm?: string
  onConfirmChange?: (pin: string) => void
  error?: string
  disabled?: boolean
}

/**
 * Choosing a PIN: first its length (4 or 6 digits), then that many boxes. The digits are dots
 * until Show is pressed.
 */
export function PinFields({
  id,
  length,
  onLengthChange,
  pin,
  onPinChange,
  confirm = '',
  onConfirmChange,
  error,
  disabled = false,
}: PinFieldsProps) {
  const [show, setShow] = useState(false)
  const errorId = `${id}-error`
  const boxes = {
    length,
    masked: !show,
    autoFocus: false,
    variant: 'tiles' as const,
    disabled,
    invalid: Boolean(error),
    describedBy: error ? errorId : undefined,
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        id={`${id}-length`}
        label="PIN length"
        value={length ? String(length) : ''}
        options={LENGTH_OPTIONS}
        disabled={disabled}
        onChange={(value) => onLengthChange(Number(value))}
      />
      {length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-text text-[0.82rem] font-semibold">PIN</span>
              <button
                type="button"
                aria-pressed={show}
                onClick={() => setShow((value) => !value)}
                className="text-accent hover:text-accent-hover cursor-pointer border-none bg-transparent p-0 text-[0.8rem] font-semibold"
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            <OtpInput
              key={length}
              {...boxes}
              label="Security PIN"
              value={pin}
              onChange={onPinChange}
            />
          </div>
          {onConfirmChange && (
            <div className="flex flex-col gap-2">
              <span className="text-text text-[0.82rem] font-semibold">Confirm PIN</span>
              <OtpInput
                key={length}
                {...boxes}
                label="Confirm security PIN"
                value={confirm}
                onChange={onConfirmChange}
              />
            </div>
          )}
        </>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-danger m-0 text-[0.78rem]">
          {error}
        </p>
      )}
    </div>
  )
}
