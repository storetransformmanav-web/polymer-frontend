import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { PlusIcon, XIcon } from '../../../../components/ui/icons.tsx'
import { blankNewVariant, LIMITS, optionChoices } from '../../utils/editDraft.ts'
import {
  DELETE_PILL,
  EditField,
  FIELD_INPUT,
  FIELD_LABEL,
  type SectionProps,
} from './fields.tsx'
import { TagsInput } from './TagsSection.tsx'

const PILL =
  'border-border-strong bg-bg inline-flex h-9 items-center rounded-full border text-[0.85rem] font-medium'

/**
 * The product's options (Size, Colour…) in the Variants editor, laid out plainly — no cards, no
 * accordions. Each option is a block: its name in a box (rename it), then a tag with the option's
 * name over its values as pills and **a box to type the next one** ("Add a size here" — Enter or
 * the +). Click a pill and it becomes a box to rename that value (`options_update`). The API has
 * no call for a bare value — the store only has a value once a variant uses it — so a new value
 * opens a new variant with that value filled in, to be priced below. A new option (**Add variant**
 * in the tab's bar) has its own name box and a tags box for its values (`options_add`), and a pink
 * **Delete** while it is only a draft; it only gives the variants added in the same edit a value
 * to choose.
 */
export function VariantOptionsEditor({ draft, errors, onChange }: SectionProps) {
  const choices = optionChoices(draft)
  const firstUnit =
    draft.variants.find((variant) => !variant.removed)?.weightUnit ?? 'GRAMS'
  // The new variants opened by a new value, and which option each one's value belongs to — their
  // values are listed with the option's own, as pills.
  const [valueOf, setValueOf] = useState<Record<string, number>>({})

  /** Opens a new variant for `value` of the option at `position`; says why when it can't. */
  const addValue = (position: number, value: string): string | null => {
    const text = value.trim()
    if (!text) return 'Type the new value first.'
    if (text.length > LIMITS.optionValue) {
      return `A value can have at most ${LIMITS.optionValue} characters.`
    }
    const same = (other: string) => other.trim().toLowerCase() === text.toLowerCase()
    if (choices[position].values.some(same)) return 'This option already has that value.'
    if (draft.newVariants.some((created) => same(created.optionValues[position] ?? ''))) {
      return 'That value is already being added below.'
    }
    const created = blankNewVariant(firstUnit)
    const optionValues = choices.map(() => '')
    optionValues[position] = text
    onChange({ newVariants: [...draft.newVariants, { ...created, optionValues }] })
    setValueOf((current) => ({ ...current, [created.key]: position }))
    // The new variant needs a price: take the person straight to it.
    setTimeout(
      () => document.getElementById(`new-variant-${created.key}-price`)?.focus(),
      0,
    )
    return null
  }

  const renameOption = (index: number, newName: string) =>
    onChange({
      options: draft.options.map((option, i) =>
        i === index ? { ...option, newName } : option,
      ),
    })
  const renameValue = (index: number, valueIndex: number, to: string) =>
    onChange({
      options: draft.options.map((option, i) =>
        i === index
          ? {
              ...option,
              values: option.values.map((value, j) =>
                j === valueIndex ? { ...value, to } : value,
              ),
            }
          : option,
      ),
    })
  const renameNewValue = (key: string, position: number, to: string) =>
    onChange({
      newVariants: draft.newVariants.map((created) => {
        if (created.key !== key) return created
        const optionValues = [...created.optionValues]
        while (optionValues.length <= position) optionValues.push('')
        optionValues[position] = to
        return { ...created, optionValues }
      }),
    })
  const dropNewValue = (key: string) =>
    onChange({ newVariants: draft.newVariants.filter((created) => created.key !== key) })
  const patchAdded = (index: number, patch: { name?: string; values?: string[] }) =>
    onChange({
      addedOptions: draft.addedOptions.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    })

  return (
    <section aria-label="Options" className="flex flex-col">
      {draft.options.map((option, index) => {
        const name = option.newName.trim() || option.name
        const pending = draft.newVariants.filter(
          (created) => valueOf[created.key] === index,
        )
        const chips: ValueChipData[] = [
          ...option.values.map((value, valueIndex) => ({
            key: `value-${value.from}`,
            text: value.to.trim(),
            label: `Value “${value.from}” of ${option.name}`,
            rename: (to: string) => renameValue(index, valueIndex, to),
          })),
          ...pending.map((created) => ({
            key: created.key,
            text: (created.optionValues[index] ?? '').trim(),
            label: `New value of ${option.name}`,
            isNew: true,
            rename: (to: string) => renameNewValue(created.key, index, to),
            remove: () => dropNewValue(created.key),
            removeLabel:
              `Remove new value ${(created.optionValues[index] ?? '').trim()}`.trim(),
          })),
        ]
        const valueErrors = option.values
          .map((_, valueIndex) => errors[`options.${index}.values.${valueIndex}`])
          .filter(Boolean)
        return (
          <div
            key={option.key}
            className="border-border flex flex-col gap-4 border-b py-5 first:pt-0 last:border-b-0 last:pb-0"
          >
            <div className="max-w-md">
              <EditField
                id={`option-${index}-name`}
                label={`Variant name (now “${option.name}”)`}
                error={errors[`options.${index}.name`]}
              >
                <input
                  id={`option-${index}-name`}
                  autoComplete="off"
                  value={option.newName}
                  maxLength={LIMITS.optionName}
                  aria-invalid={errors[`options.${index}.name`] ? true : undefined}
                  onChange={(event) => renameOption(index, event.target.value)}
                  className={FIELD_INPUT}
                />
              </EditField>
            </div>
            <div className="flex flex-col gap-2">
              <p
                className={`${FIELD_LABEL} flex items-center gap-2`}
                id={`option-${index}-values-label`}
              >
                <span className="bg-accent-tint border-border-strong rounded-md border px-2 py-0.5">
                  {name}
                </span>
                <span className="text-text-muted text-[0.72rem] font-normal">
                  {chips.filter((chip) => chip.text).length}
                </span>
              </p>
              <ul
                aria-labelledby={`option-${index}-values-label`}
                className="flex flex-wrap items-start gap-2"
              >
                {chips
                  .filter((chip) => chip.text)
                  .map((chip) => (
                    <li key={chip.key}>
                      <ValueChip chip={chip} />
                    </li>
                  ))}
                <li className="min-w-0">
                  <AddValueBox
                    id={`new-value-${option.key}`}
                    name={name}
                    onAdd={(value) => addValue(index, value)}
                  />
                </li>
              </ul>
              {valueErrors.map((message) => (
                <p key={message} role="alert" className="text-danger text-[0.76rem]">
                  {message}
                </p>
              ))}
            </div>
          </div>
        )
      })}

      {draft.addedOptions.map((option, index) => (
        <div
          key={option.key}
          className="border-border bg-accent-tint/20 -mx-5 flex flex-col gap-4 border-b px-5 py-5 last:border-b-0"
        >
          <div className="flex items-center gap-2">
            <Badge tone="success">New</Badge>
            <span className="text-[0.82rem] font-semibold">
              {option.name.trim() || 'New option'}
            </span>
          </div>
          <div className="max-w-md">
            <EditField
              id={`added-option-${index}-name`}
              label="New variant name"
              error={errors[`addedOptions.${index}.name`]}
            >
              <input
                id={`added-option-${index}-name`}
                autoComplete="off"
                value={option.name}
                maxLength={LIMITS.optionName}
                placeholder="e.g. Colour"
                aria-invalid={errors[`addedOptions.${index}.name`] ? true : undefined}
                onChange={(event) => patchAdded(index, { name: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
          </div>
          <div className="flex flex-col gap-2">
            <p className={FIELD_LABEL}>Variant values</p>
            <TagsInput
              id={`added-option-${index}-values`}
              ariaLabel={`Values of ${option.name || 'the new option'}`}
              listLabel="Values"
              removeLabel={(value) => `Remove value ${value}`}
              placeholder="Type a value and press Enter"
              tags={option.values}
              onChange={(values) => patchAdded(index, { values })}
            />
            {errors[`addedOptions.${index}.values`] && (
              <p role="alert" className="text-danger text-[0.78rem]">
                {errors[`addedOptions.${index}.values`]}
              </p>
            )}
          </div>
          <div>
            <button
              type="button"
              aria-label={`Remove new option ${option.name || index + 1}`}
              onClick={() =>
                onChange({
                  addedOptions: draft.addedOptions.filter((_, i) => i !== index),
                })
              }
              className={DELETE_PILL}
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {errors.addedOptions && (
        <p role="alert" className="text-danger pt-3 text-[0.82rem] font-medium">
          {errors.addedOptions}
        </p>
      )}
    </section>
  )
}

/** One value of an option, shown as a pill. */
interface ValueChipData {
  key: string
  text: string
  /** The box's accessible name while it is being renamed. */
  label?: string
  isNew?: boolean
  /** Renames it (a draft's value or a value of the product's option). */
  rename?: (to: string) => void
  /** Takes it away (a value that is only being added). */
  remove?: () => void
  removeLabel?: string
}

/**
 * A value as a pill: **click it and it becomes a box** holding the value — like a tag in the
 * Overview — Enter or leaving the box keeps the new name, Escape puts the old one back. A value
 * that is only being added also has a small ✕.
 */
function ValueChip({ chip }: { chip: ValueChipData }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(chip.text)
  const tone = chip.isNew ? 'border-accent/60 bg-accent-tint/40' : ''

  function finish(keep: boolean) {
    setEditing(false)
    const next = text.trim()
    if (keep && next !== '' && next !== chip.text) chip.rename?.(next)
    else setText(chip.text)
  }

  if (editing) {
    return (
      <input
        autoFocus
        aria-label={chip.label ?? `Value ${chip.text}`}
        autoComplete="off"
        value={text}
        maxLength={LIMITS.optionValue}
        onChange={(event) => setText(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.stopPropagation()
            finish(true)
          } else if (event.key === 'Escape') {
            // Only this box: the section's own Escape would discard the whole edit.
            event.stopPropagation()
            finish(false)
          }
        }}
        className={`${PILL} border-accent bg-bg text-text focus:outline-accent-tint w-36 px-4 outline-none focus:outline-2 ${tone}`}
      />
    )
  }

  return (
    <span className={`${PILL} ${tone} ${chip.remove ? 'pr-1' : ''}`}>
      <button
        type="button"
        title={chip.rename ? 'Click to rename' : undefined}
        disabled={!chip.rename}
        onClick={() => {
          setText(chip.text)
          setEditing(true)
        }}
        className={`text-text h-full cursor-text border-none bg-transparent pl-4 text-[0.85rem] font-medium disabled:cursor-default ${
          chip.remove ? 'pr-2' : 'pr-4'
        }`}
      >
        {chip.text}
      </button>
      {chip.remove && (
        <button
          type="button"
          aria-label={chip.removeLabel ?? `Remove ${chip.text}`}
          onClick={chip.remove}
          className="text-text-muted hover:text-danger inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors"
        >
          <XIcon width={12} height={12} />
        </button>
      )}
    </span>
  )
}

/**
 * The box beside an option's pills where the next value is typed — "Add a size here" — Enter or
 * the small +. A new value comes with a new variant, which is then priced below. The box stays
 * for the next value.
 */
function AddValueBox({
  id,
  name,
  onAdd,
}: {
  id: string
  name: string
  onAdd: (value: string) => string | null
}) {
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const submit = () => {
    const message = onAdd(text)
    setProblem(message)
    if (!message) setText('')
  }

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <input
          id={id}
          aria-label={`New value for ${name}`}
          autoComplete="off"
          value={text}
          maxLength={LIMITS.optionValue}
          placeholder={`Add a ${name.toLowerCase()} here`}
          title="A new value comes with a new variant, which you price below."
          aria-invalid={problem ? true : undefined}
          onChange={(event) => {
            setText(event.target.value)
            setProblem(null)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            // Enter adds the value; it must not save the section.
            event.preventDefault()
            event.stopPropagation()
            submit()
          }}
          className={`${PILL} focus:outline-accent-tint aria-[invalid=true]:border-danger w-52 min-w-0 px-4 outline-none focus:outline-2`}
        />
        <button
          type="button"
          aria-label={`Add value to ${name}`}
          onClick={submit}
          className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none transition-colors"
        >
          <PlusIcon width={14} height={14} />
        </button>
      </span>
      {problem && (
        <p role="alert" className="text-danger m-0 text-[0.78rem]">
          {problem}
        </p>
      )}
    </span>
  )
}
