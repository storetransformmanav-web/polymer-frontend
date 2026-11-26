import { useState } from 'react'
import { PlusIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { Switch } from '../../../../components/ui/Switch.tsx'
import { readList, validateMetafieldValue } from '../../utils/metafieldValues.ts'
import {
  EditField,
  FIELD_INPUT,
  FIELD_TEXTAREA,
  ICON_BUTTON,
  TEXT_BUTTON,
} from './fields.tsx'

interface InputProps {
  id: string
  type: string
  value: string
  invalid: boolean
  /** The input's accessible name, for a list's entries (the first one takes the field's label). */
  label?: string
  onChange: (value: string) => void
}

const openPicker = (input: HTMLInputElement) => {
  try {
    input.showPicker()
  } catch {
    // No picker here: the box still works by typing.
  }
}

const ZONE = /(Z|[+-]\d{2}:\d{2})$/

/** One value of one kind: the box (or picker, or switch) that suits it. */
function SingleInput({ id, type, value, invalid, label, onChange }: InputProps) {
  const common = {
    id,
    'aria-label': label,
    'aria-invalid': invalid ? true : undefined,
  } as const

  if (type === 'boolean') {
    return (
      <span className="flex h-10 items-center">
        <Switch
          label={value === 'true' ? 'Yes' : value === 'false' ? 'No' : 'Not set'}
          checked={value === 'true'}
          onChange={(checked) => onChange(checked ? 'true' : 'false')}
        />
      </span>
    )
  }

  if (type === 'multi_line_text_field' || type === 'rich_text_field') {
    return (
      <textarea
        {...common}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_TEXTAREA}
      />
    )
  }

  if (type === 'json' || type === 'json_string') {
    return (
      <textarea
        {...common}
        rows={5}
        spellCheck={false}
        placeholder='{"care": "Hand wash"}'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_TEXTAREA} font-mono text-[0.8rem]`}
      />
    )
  }

  if (type === 'date') {
    return (
      <input
        {...common}
        type="date"
        value={value.slice(0, 10)}
        onClick={(event) => openPicker(event.currentTarget)}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_INPUT} cursor-pointer`}
      />
    )
  }

  if (type === 'date_time') {
    // The picker has no time zone: one the saved value carries is kept when it is changed.
    const zone = ZONE.exec(value)?.[0] ?? ''
    return (
      <input
        {...common}
        type="datetime-local"
        step={1}
        value={value.replace(ZONE, '').slice(0, 19)}
        onClick={(event) => openPicker(event.currentTarget)}
        onChange={(event) => {
          const next = event.target.value
          onChange(next ? `${next.length === 16 ? `${next}:00` : next}${zone}` : '')
        }}
        className={`${FIELD_INPUT} cursor-pointer`}
      />
    )
  }

  if (type === 'color') {
    const valid = /^#[0-9a-f]{6}$/i.test(value)
    return (
      <span className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label ?? 'Value'} colour picker`}
          value={valid ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="border-border bg-bg h-10 w-12 shrink-0 cursor-pointer rounded-lg border p-1"
        />
        <input
          {...common}
          autoComplete="off"
          spellCheck={false}
          placeholder="#1a73e8"
          maxLength={7}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD_INPUT} font-mono`}
        />
      </span>
    )
  }

  return (
    <input
      {...common}
      type={type === 'url' ? 'url' : 'text'}
      inputMode={
        type === 'url' ? 'url' : type.startsWith('number_') ? 'decimal' : undefined
      }
      placeholder={type === 'url' ? 'https://example.com' : undefined}
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={FIELD_INPUT}
    />
  )
}

/** Lists whose entries have their own input (a link box, a date picker, a colour picker). */
const ENTRY_LISTS = ['list.url', 'list.date', 'list.color']

/** A list: one input per entry, with Add and remove. The value stays the JSON array Shopify takes. */
function ListInput({ id, type, value, invalid, onChange }: InputProps) {
  const items = value.trim() === '' ? [''] : readList(value)
  // A saved value that is not a readable list is shown as it is, to be corrected by hand.
  if (!items) {
    return (
      <textarea
        id={id}
        rows={4}
        spellCheck={false}
        value={value}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_TEXTAREA} font-mono text-[0.8rem]`}
      />
    )
  }
  const inner = type.slice(5)
  const write = (next: string[]) =>
    onChange(next.length === 1 && next[0] === '' ? '' : JSON.stringify(next))
  const shown = items.length === 0 ? [''] : items

  return (
    <div className="flex flex-col gap-2">
      {shown.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <SingleInput
              id={index === 0 ? id : `${id}-${index}`}
              label={index === 0 ? undefined : `Value ${index + 1}`}
              type={inner}
              value={item}
              invalid={invalid}
              onChange={(next) =>
                write(shown.map((entry, i) => (i === index ? next : entry)))
              }
            />
          </div>
          {shown.length > 1 && (
            <button
              type="button"
              aria-label={`Remove value ${index + 1}`}
              onClick={() => write(shown.filter((_, i) => i !== index))}
              className={`${ICON_BUTTON} hover:text-danger`}
            >
              <XIcon width={15} height={15} />
            </button>
          )}
        </div>
      ))}
      <div>
        <button
          type="button"
          className={TEXT_BUTTON}
          // JSON keeps the empty new entry, so its box shows until it is filled in.
          onClick={() => onChange(JSON.stringify([...shown, '']))}
        >
          <PlusIcon width={14} height={14} />
          Add value
        </button>
      </div>
    </div>
  )
}

/**
 * A metafield's **Value**: the input follows the chosen type (JSON box, date or date-time picker,
 * link box, colour picker, on/off switch, one line or several), and the value is checked against
 * that type. A problem shows once the person leaves the box (or has tried to save); a value nobody
 * changed is never flagged, so an odd one already in the store blocks nothing.
 */
export function MetafieldValueField({
  id,
  type,
  value,
  error,
  maxLength,
  onChange,
}: {
  id: string
  type: string
  value: string
  /** The form's own check (run when saving). */
  error?: string
  maxLength?: number
  onChange: (value: string) => void
}) {
  const [initial] = useState(value)
  const [leftFor, setLeftFor] = useState<string | null>(null)

  const text = value.trim()
  const problem = text && value !== initial ? validateMetafieldValue(type, text) : null
  // "Left" counts only for the type the box had then: a new type starts clean.
  const shown = !text
    ? error
    : problem
      ? leftFor === type || error
        ? problem
        : undefined
      : maxLength && text.length > maxLength
        ? error
        : undefined

  const Input = ENTRY_LISTS.includes(type) ? ListInput : SingleInput

  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setLeftFor(type)
      }}
    >
      <EditField id={id} label="Value" error={shown}>
        {type.startsWith('list.') && !ENTRY_LISTS.includes(type) ? (
          <textarea
            id={id}
            rows={4}
            spellCheck={false}
            value={value}
            aria-invalid={shown ? true : undefined}
            onChange={(event) => onChange(event.target.value)}
            className={`${FIELD_TEXTAREA} font-mono text-[0.8rem]`}
          />
        ) : (
          <Input
            id={id}
            type={type}
            value={value}
            invalid={Boolean(shown)}
            onChange={onChange}
          />
        )}
      </EditField>
    </div>
  )
}
