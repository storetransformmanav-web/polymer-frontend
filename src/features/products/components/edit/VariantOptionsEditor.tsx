import { useState, type ReactNode } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import { ChevronDownIcon, TrashIcon } from '../../../../components/ui/icons.tsx'
import { blankNewVariant, LIMITS, optionChoices } from '../../utils/editDraft.ts'
import {
  DELETE_PILL,
  DONE_PILL,
  EditField,
  FIELD_INPUT,
  FIELD_LABEL,
  ICON_BUTTON,
  TEXT_BUTTON,
  type SectionProps,
} from './fields.tsx'
import { TagsInput } from './TagsSection.tsx'

/** The grid's columns from `lg` up, and the line on a cell's right edge (none on a row's last cell). */
const COLUMNS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' } as const
const EDGE = {
  1: '',
  2: 'lg:border-r lg:[&:nth-child(2n)]:border-r-0',
  3: 'lg:border-r lg:[&:nth-child(3n)]:border-r-0',
} as const

/**
 * The product's options (Size, Colour…) in the Variants editor: each option is its own card, an
 * **accordion** — closed to begin with, showing its name and a chip per value; opening it shows
 * its name, its values (one box each, then "Add another value") and a dark **Done** that closes
 * it again. A new option (from **Add variant** in the Current variants card) starts open,
 * with a pink **Delete** while it is only a draft. Rename an option or any value
 * (`options_update`); add a new option with its values (`options_add`). The API has no call for a
 * bare value — the store only has a value once a variant uses it — so **Add value** opens a new
 * variant (below) with that value filled in for you to price. A new option only gives the
 * variants that are added in the same edit a value to choose; the variants already there are not
 * changed by it.
 */
export function VariantOptionsEditor({ draft, errors, onChange }: SectionProps) {
  // Three cells to a row at most; fewer options make wider cells instead of an empty column.
  const cols = Math.min(
    Math.max(draft.options.length + draft.addedOptions.length, 1),
    3,
  ) as 1 | 2 | 3
  const choices = optionChoices(draft)
  const firstUnit =
    draft.variants.find((variant) => !variant.removed)?.weightUnit ?? 'GRAMS'
  // The new variants opened by "Add value", and which option each one's value belongs to — their
  // values are listed with the option's own, in the same boxes.
  const [valueOf, setValueOf] = useState<Record<string, number>>({})
  // Cards the person has flipped from how they start: an option of the product starts closed, a
  // new one starts open.
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(() => new Set())

  const flip = (key: string) =>
    setFlipped((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

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
    <section aria-label="Options" className={`-mb-px grid grid-cols-1 ${COLUMNS[cols]}`}>
      {draft.options.map((option, index) => {
        const name = option.newName.trim() || option.name
        const pending = draft.newVariants.filter(
          (created) => valueOf[created.key] === index,
        )
        const hasError = Object.keys(errors).some((key) =>
          key.startsWith(`options.${index}.`),
        )
        // Closed to begin with; a problem inside opens it.
        const isOpen = flipped.has(option.key) || hasError
        const values = [
          ...option.values.map((value) => value.to.trim()),
          ...pending.map((created) => (created.optionValues[index] ?? '').trim()),
        ]
        return (
          <OptionCard
            key={option.key}
            edge={EDGE[cols]}
            id={option.key}
            name={name}
            values={values}
            open={isOpen}
            onToggle={() => flip(option.key)}
            onAddValue={() => {
              if (!isOpen) flip(option.key)
              setTimeout(
                () => document.getElementById(`new-value-${option.key}`)?.focus(),
                0,
              )
            }}
          >
            <div className="flex flex-col gap-3">
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
              <div className="flex flex-col gap-2">
                <p className={FIELD_LABEL}>Variant values</p>
                <ul aria-label={`${option.name} values`} className="flex flex-col gap-2">
                  {option.values.map((value, valueIndex) => {
                    const error = errors[`options.${index}.values.${valueIndex}`]
                    return (
                      <li key={value.from} className="flex flex-col gap-1">
                        <input
                          aria-label={`Value “${value.from}” of ${option.name}`}
                          autoComplete="off"
                          value={value.to}
                          maxLength={LIMITS.optionValue}
                          aria-invalid={error ? true : undefined}
                          onChange={(event) =>
                            renameValue(index, valueIndex, event.target.value)
                          }
                          className={FIELD_INPUT}
                        />
                        {error && (
                          <p role="alert" className="text-danger text-[0.76rem]">
                            {error}
                          </p>
                        )}
                      </li>
                    )
                  })}
                  {pending.map((created) => (
                    <li key={created.key} className="flex items-center gap-2">
                      <input
                        aria-label={`New value of ${option.name}`}
                        autoComplete="off"
                        value={created.optionValues[index] ?? ''}
                        maxLength={LIMITS.optionValue}
                        onChange={(event) =>
                          renameNewValue(created.key, index, event.target.value)
                        }
                        className={`${FIELD_INPUT} border-accent/60 bg-accent-tint/30`}
                      />
                      <Badge tone="success">New</Badge>
                      <button
                        type="button"
                        aria-label={`Remove new value ${created.optionValues[index] ?? ''}`.trim()}
                        onClick={() => dropNewValue(created.key)}
                        className={`${ICON_BUTTON} hover:text-danger`}
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                <AddValue
                  id={`new-value-${option.key}`}
                  name={name}
                  onAdd={(value) => addValue(index, value)}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => flip(option.key)}
                  className={DONE_PILL}
                >
                  Done
                </button>
              </div>
            </div>
          </OptionCard>
        )
      })}

      {draft.addedOptions.map((option, index) => {
        const usable = option.name.trim() !== '' && option.values.length > 0
        const hasError = Object.keys(errors).some((key) =>
          key.startsWith(`addedOptions.${index}.`),
        )
        // A new option starts open, so its name and values can be typed at once.
        const isOpen = !flipped.has(option.key) || hasError
        return (
          <OptionCard
            key={option.key}
            edge={EDGE[cols]}
            id={option.key}
            name={option.name.trim() || 'New option'}
            values={option.values}
            isNew
            open={isOpen}
            onToggle={() => flip(option.key)}
          >
            <div className="flex flex-col gap-3">
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
              <p className={`${FIELD_LABEL} -mb-1`}>Variant values</p>
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
              <div className="flex items-center justify-between gap-3">
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
                <button
                  type="button"
                  disabled={!usable}
                  onClick={() => flip(option.key)}
                  className={DONE_PILL}
                >
                  Done
                </button>
              </div>
            </div>
          </OptionCard>
        )
      })}

      {errors.addedOptions && (
        <p
          role="alert"
          className="text-danger border-border-strong col-span-full border-b px-5 py-2.5 text-[0.82rem] font-medium"
        >
          {errors.addedOptions}
        </p>
      )}
    </section>
  )
}

/**
 * One option as a column of the Variant options card: its name (the toggle, with a chevron), a
 * pill per value and an **Add value** pill; opening it shows the fields below. A card the person
 * can fold away again.
 */
function OptionCard({
  id,
  edge,
  name,
  values,
  isNew = false,
  open,
  onToggle,
  onAddValue,
  children,
}: {
  id: string
  edge: string
  name: string
  values: string[]
  isNew?: boolean
  open: boolean
  onToggle: () => void
  /** Opens the card and goes to its "new value" box (not offered for a draft option). */
  onAddValue?: () => void
  children: ReactNode
}) {
  const bodyId = `option-card-${id}`
  const shown = values.filter(Boolean)
  return (
    <div
      className={`border-border-strong flex min-w-0 flex-col gap-3.5 border-b p-5 ${edge} ${
        isNew ? 'bg-accent-tint/20' : 'bg-bg'
      }`}
    >
      <button
        type="button"
        aria-label={`Option ${name}`}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
      >
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
        <span className="min-w-0 truncate text-[0.95rem] font-semibold">{name}</span>
        {isNew && <Badge tone="success">New</Badge>}
        <span className="bg-surface text-text-muted border-border rounded-full border px-2 py-0.5 text-[0.68rem] font-bold">
          {shown.length}
        </span>
      </button>
      {!open && (shown.length > 0 || onAddValue) && (
        <div className="flex flex-wrap gap-2">
          {shown.map((value) => (
            <span
              key={value}
              className="border-border-strong bg-bg inline-flex h-9 items-center rounded-full border px-4 text-[0.85rem] font-medium"
            >
              {value}
            </span>
          ))}
          {onAddValue && (
            <button
              type="button"
              aria-label={`Add a value to ${name}`}
              onClick={onAddValue}
              className="border-border-strong bg-bg hover:bg-accent-tint/60 inline-flex h-9 cursor-pointer items-center rounded-full border px-4 text-[0.85rem] font-medium transition-colors"
            >
              Add value
            </button>
          )}
        </div>
      )}
      {open && (
        <div id={bodyId} className="border-border-strong border-t pt-4">
          {children}
        </div>
      )}
    </div>
  )
}

/** The "Add another value" box under an option's values (a new value opens a new variant). */
function AddValue({
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          id={id}
          aria-label={`New value for ${name}`}
          autoComplete="off"
          value={text}
          maxLength={LIMITS.optionValue}
          placeholder="Add another value"
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
          className={`${FIELD_INPUT} min-w-0 flex-1`}
        />
        <button
          type="button"
          aria-label={`Add value to ${name}`}
          onClick={submit}
          className={TEXT_BUTTON}
        >
          Add value
        </button>
      </div>
      {problem ? (
        <p role="alert" className="text-danger text-[0.78rem]">
          {problem}
        </p>
      ) : (
        <p className="text-text-muted text-[0.76rem]">
          A new value comes with a new variant, which you price below.
        </p>
      )}
    </div>
  )
}
