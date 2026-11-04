import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge.tsx'
import {
  ChevronDownIcon,
  GridIcon,
  PaletteIcon,
  PlusIcon,
  ShirtIcon,
  TagIcon,
  XIcon,
} from '../../../../components/ui/icons.tsx'
import { blankNewVariant, LIMITS, optionChoices } from '../../utils/editDraft.ts'
import { DELETE_PILL, type SectionProps } from './fields.tsx'
import { TagsInput } from './TagsSection.tsx'

// A value inside an option's row: a rounded pill.
const PILL =
  'border-border-strong bg-accent-tint/50 inline-flex h-8 items-center rounded-full border text-[0.82rem] font-medium'

/** The name box of an option row: reads as plain text until the pointer or the cursor is in it. */
const NAME_BOX =
  'text-text hover:border-border focus:border-accent focus:outline-accent-tint h-8 w-28 min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-[0.85rem] font-semibold outline-none focus:outline-2'

const ROUND_PLUS =
  'bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none transition-colors'

/** The round tile at the start of an option row: a shirt for Size, a palette for Colour. */
function IconTile({ name }: { name: string }) {
  const key = name.trim().toLowerCase()
  return (
    <span className="bg-accent-tint text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
      {key === 'size' ? (
        <ShirtIcon width={18} height={18} />
      ) : key === 'color' || key === 'colour' ? (
        <PaletteIcon width={18} height={18} />
      ) : (
        <TagIcon width={18} height={18} />
      )}
    </span>
  )
}

/**
 * The product's options (Size, Colour…) as the **Variant Options** card of the Edit Variants page:
 * a header you can fold, then a row per option — a round icon tile, the option's name (a box that
 * reads as text: type to rename it) and its values as pills (click a pill to rename that value,
 * `options_update`), and a round **+**: clicking it turns the end of that row into a value box
 * ("Value (e.g. Red)"); Enter (or its round **+**) adds the value and the box stays for the next
 * one, Escape or its ✕ closes it. The API has no call for a bare value — the store only has one
 * once a variant uses it — so a new value opens a new variant with it filled in, to be priced
 * below. A new option (**Add variant** in the page header) is a row
 * of its own with a name box, a tags box for its values (`options_add`) and a pink **Delete**.
 */
export function VariantOptionsEditor({ product, draft, errors, onChange }: SectionProps) {
  const choices = optionChoices(draft)
  const [open, setOpen] = useState(true)
  // Which existing option's row shows the box for a new value (one at a time).
  const [addingTo, setAddingTo] = useState<number | null>(null)
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
  /**
   * The variants of the product that use `value` of the option called `optionName`. The store has
   * no call for a bare value — a value is gone once no variant uses it — so deleting a value
   * means deleting these variants (`variants_remove`).
   */
  const variantsUsing = (optionName: string, value: string) =>
    draft.variants.filter((variant) =>
      product.variants
        .find((original) => original.id === variant.id)
        ?.selected_options?.some(
          (entry) => entry.name === optionName && entry.value === value,
        ),
    )
  /** Marks (or un-marks) those variants for deletion; nothing is sent until Save. */
  const setValueDeleted = (optionName: string, value: string, removed: boolean) => {
    const ids = new Set(variantsUsing(optionName, value).map((variant) => variant.id))
    onChange({
      variants: draft.variants.map((variant) =>
        ids.has(variant.id) ? { ...variant, removed } : variant,
      ),
    })
  }
  const dropNewValue = (key: string) =>
    onChange({ newVariants: draft.newVariants.filter((created) => created.key !== key) })
  const patchAdded = (index: number, patch: { name?: string; values?: string[] }) =>
    onChange({
      addedOptions: draft.addedOptions.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    })

  return (
    <>
      <section
        aria-label="Variant options"
        className="border-border-strong bg-bg overflow-hidden rounded-xl border"
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="bg-accent-tint/60 hover:bg-accent-tint flex w-full cursor-pointer items-center gap-3 border-none px-4 py-3 text-left transition-colors"
        >
          <GridIcon width={18} height={18} className="text-accent shrink-0" />
          <span className="text-[0.9rem] font-semibold">Variant Options</span>
          <ChevronDownIcon
            width={16}
            height={16}
            className={`text-text-muted ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <section aria-label="Options" className="flex flex-col">
            {draft.options.map((option, index) => {
              const name = option.newName.trim() || option.name
              const pending = draft.newVariants.filter(
                (created) => valueOf[created.key] === index,
              )
              const deleting: string[] = []
              const chips: ValueChipData[] = [
                ...option.values.map((value, valueIndex) => {
                  const using = variantsUsing(option.name, value.from)
                  const gone =
                    using.length > 0 && using.every((variant) => variant.removed)
                  if (gone) {
                    deleting.push(
                      `“${value.from}” will be deleted with ${using.length} ${
                        using.length === 1 ? 'variant' : 'variants'
                      } when you save (see Current variants).`,
                    )
                  }
                  return {
                    key: `value-${value.from}`,
                    text: value.to.trim(),
                    label: `Value “${value.from}” of ${option.name}`,
                    removed: gone,
                    rename: gone
                      ? undefined
                      : (to: string) => renameValue(index, valueIndex, to),
                    remove:
                      using.length > 0 && !gone
                        ? () => setValueDeleted(option.name, value.from, true)
                        : undefined,
                    removeLabel: `Delete value ${value.from} of ${option.name}`,
                    removeTitle: `Delete this value (also deletes the ${using.length} ${
                      using.length === 1 ? 'variant' : 'variants'
                    } that use it, when you save)`,
                    restore: gone
                      ? () => setValueDeleted(option.name, value.from, false)
                      : undefined,
                  }
                }),
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
              const messages = [
                errors[`options.${index}.name`],
                ...option.values.map(
                  (_, valueIndex) => errors[`options.${index}.values.${valueIndex}`],
                ),
              ].filter(Boolean)
              return (
                <div
                  key={option.key}
                  className="border-border flex flex-col gap-1 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <IconTile name={name} />
                    <input
                      id={`option-${index}-name`}
                      aria-label={`Variant name (now “${option.name}”)`}
                      autoComplete="off"
                      value={option.newName}
                      maxLength={LIMITS.optionName}
                      aria-invalid={errors[`options.${index}.name`] ? true : undefined}
                      onChange={(event) => renameOption(index, event.target.value)}
                      className={NAME_BOX}
                    />
                    <ul
                      aria-label={`Values of ${name}`}
                      className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-2 p-0"
                    >
                      {chips
                        .filter((chip) => chip.text)
                        .map((chip) => (
                          <li key={chip.key} className="flex">
                            <ValueChip chip={chip} />
                          </li>
                        ))}
                    </ul>
                    {addingTo === index ? (
                      <AddValueBox
                        name={name}
                        onAdd={(value) => addValue(index, value)}
                        onClose={() => setAddingTo(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        aria-label={`Add a value to ${name}`}
                        title={`Add a value to ${name}`}
                        onClick={() => setAddingTo(index)}
                        className={ROUND_PLUS}
                      >
                        <PlusIcon width={16} height={16} />
                      </button>
                    )}
                  </div>
                  {deleting.map((note) => (
                    <p key={note} className="text-danger m-0 text-[0.76rem]">
                      {note}
                    </p>
                  ))}
                  {messages.map((message) => (
                    <p
                      key={message}
                      role="alert"
                      className="text-danger m-0 text-[0.76rem]"
                    >
                      {message}
                    </p>
                  ))}
                </div>
              )
            })}

            {draft.addedOptions.map((option, index) => (
              <div
                key={option.key}
                className="border-border bg-accent-tint/20 flex flex-col gap-2 border-b px-4 py-3 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <IconTile name={option.name} />
                  <Badge tone="success">New</Badge>
                  <input
                    id={`added-option-${index}-name`}
                    aria-label="New variant name"
                    autoComplete="off"
                    value={option.name}
                    maxLength={LIMITS.optionName}
                    placeholder="e.g. Colour"
                    aria-invalid={errors[`addedOptions.${index}.name`] ? true : undefined}
                    onChange={(event) => patchAdded(index, { name: event.target.value })}
                    className={`${NAME_BOX} border-border bg-bg`}
                  />
                  <div className="min-w-48 flex-1">
                    <TagsInput
                      id={`added-option-${index}-values`}
                      ariaLabel={`Values of ${option.name || 'the new option'}`}
                      listLabel="Values"
                      removeLabel={(value) => `Remove value ${value}`}
                      placeholder="Type a value and press Enter"
                      tags={option.values}
                      onChange={(values) => patchAdded(index, { values })}
                    />
                  </div>
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
                {errors[`addedOptions.${index}.name`] && (
                  <p role="alert" className="text-danger m-0 text-[0.76rem]">
                    {errors[`addedOptions.${index}.name`]}
                  </p>
                )}
                {errors[`addedOptions.${index}.values`] && (
                  <p role="alert" className="text-danger m-0 text-[0.76rem]">
                    {errors[`addedOptions.${index}.values`]}
                  </p>
                )}
              </div>
            ))}

            {errors.addedOptions && (
              <p
                role="alert"
                className="text-danger px-4 py-3 text-[0.82rem] font-medium"
              >
                {errors.addedOptions}
              </p>
            )}
          </section>
        )}
      </section>
    </>
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
  /** Takes it away: a value only being added, or an existing one (its variants are deleted). */
  remove?: () => void
  removeLabel?: string
  removeTitle?: string
  /** An existing value marked for deletion: shown struck through, with an Undo. */
  removed?: boolean
  restore?: () => void
}

/**
 * A value as a pill: **click it and it becomes a box** holding the value — like a tag in the
 * Overview — Enter or leaving the box keeps the new name, Escape puts the old one back. A value
 * that is only being added also has a small ✕.
 */
function ValueChip({ chip }: { chip: ValueChipData }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(chip.text)
  const tone = chip.removed
    ? 'border-danger/60 bg-danger-bg'
    : chip.isNew
      ? 'border-accent/60 bg-accent-tint'
      : ''

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
            // Only this box: the page's own Escape would discard the whole edit.
            event.stopPropagation()
            finish(false)
          }
        }}
        className={`${PILL} border-accent bg-bg text-text focus:outline-accent-tint w-32 px-3 outline-none focus:outline-2 ${tone}`}
      />
    )
  }

  return (
    <span className={`${PILL} ${tone} ${chip.remove || chip.restore ? 'pr-1' : ''}`}>
      <button
        type="button"
        title={chip.rename ? 'Click to rename' : undefined}
        disabled={!chip.rename}
        onClick={() => {
          setText(chip.text)
          setEditing(true)
        }}
        className={`text-text h-full cursor-text border-none bg-transparent pl-3 text-[0.82rem] font-medium disabled:cursor-default ${
          chip.remove || chip.restore ? 'pr-1' : 'pr-3'
        } ${chip.removed ? 'line-through' : ''}`}
      >
        {chip.text}
      </button>
      {chip.restore && (
        <button
          type="button"
          aria-label={`Undo delete of value ${chip.text}`}
          onClick={chip.restore}
          className="text-accent hover:text-accent-hover h-full cursor-pointer border-none bg-transparent pr-3 text-[0.78rem] font-semibold"
        >
          Undo
        </button>
      )}
      {chip.remove && (
        <button
          type="button"
          title={chip.removeTitle}
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
 * The box a row's **+** turns into: "Value (e.g. Red)", a round **+** and a ✕. Enter (or the +)
 * adds the value — commas separate several — and empties the box for the next one; a refused value
 * stays in the box with its reason. Escape or the ✕ closes it. A new value comes with a new
 * variant, which is then priced below.
 */
function AddValueBox({
  name,
  onAdd,
  onClose,
}: {
  name: string
  onAdd: (value: string) => string | null
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  /** Adds every value in `raw` (commas separate several); keeps the ones that were refused. */
  const submit = (raw: string) => {
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) {
      setProblem(raw.trim() ? null : 'Type the new value first.')
      return
    }
    const left: string[] = []
    let message: string | null = null
    for (const part of parts) {
      const refused = onAdd(part)
      if (refused) {
        message = refused
        left.push(part)
      }
    }
    setProblem(message)
    setText(left.join(', '))
  }

  return (
    <div className="flex min-w-56 flex-1 basis-full flex-col gap-1 sm:basis-auto">
      <div className="flex items-center gap-2">
        <div className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 transition-colors focus-within:outline-2">
          <span aria-hidden="true" className="text-text-muted text-[0.78rem] font-bold">
            Aa
          </span>
          <input
            autoFocus
            aria-label={`New value for ${name}`}
            autoComplete="off"
            value={text}
            maxLength={LIMITS.optionValue * 4}
            placeholder="Value (e.g. Red)"
            title="A new value comes with a new variant, which you price below."
            aria-invalid={problem ? true : undefined}
            onChange={(event) => {
              const next = event.target.value
              setProblem(null)
              // A comma finishes a value, as in the tags box.
              if (next.includes(',')) submit(next)
              else setText(next)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // Enter adds the value; it must not save the page.
                event.preventDefault()
                event.stopPropagation()
                submit(text)
              } else if (event.key === 'Escape') {
                // Only this box: the page's own Escape would discard the whole edit.
                event.stopPropagation()
                onClose()
              }
            }}
            className="text-text placeholder:text-text-muted/70 h-full! min-w-0 flex-1 border-none bg-transparent text-[0.85rem]! outline-none"
          />
        </div>
        <button
          type="button"
          aria-label={`Add value to ${name}`}
          title="Add this value"
          onClick={() => submit(text)}
          className={ROUND_PLUS}
        >
          <PlusIcon width={16} height={16} />
        </button>
        <button
          type="button"
          aria-label={`Stop adding values to ${name}`}
          title="Close"
          onClick={onClose}
          className="text-text-muted hover:text-text hover:bg-accent-tint inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent transition-colors"
        >
          <XIcon width={14} height={14} />
        </button>
      </div>
      {problem && (
        <p role="alert" className="text-danger m-0 text-[0.78rem]">
          {problem}
        </p>
      )}
    </div>
  )
}
