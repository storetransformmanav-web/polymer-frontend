import { useState } from 'react'
import type {
  ProductDetail,
  ProductUpdateBody,
  ProductVariant,
} from '../../../lib/api/endpoints.ts'
import { useSaveProduct } from '../hooks/useSaveProduct.ts'
import type { SavedHandler } from '../hooks/useSectionEdit.ts'
import { LIMITS } from '../utils/editDraft.ts'
import { ConfirmUpdateDialog } from './ConfirmUpdateDialog.tsx'

type Change =
  | { kind: 'name'; option: string; to: string }
  | { kind: 'value'; option: string; from: string; to: string }

/**
 * The variant that goes with a click on `value` of the option `name`: one that has that value and
 * agrees with the current choice on as many of the other options as possible (so clicking Large
 * while Blue is chosen goes to Large / Blue when there is one, else to another Large).
 */
export function variantFor(
  variants: ProductVariant[],
  current: ProductVariant,
  name: string,
  value: string,
): ProductVariant | null {
  const wanted = new Map((current.selected_options ?? []).map((o) => [o.name, o.value]))
  wanted.set(name, value)
  let best: ProductVariant | null = null
  let bestScore = -1
  for (const variant of variants) {
    const options = variant.selected_options ?? []
    if (!options.some((o) => o.name === name && o.value === value)) continue
    const score = options.filter((o) => wanted.get(o.name) === o.value).length
    if (score > bestScore) {
      best = variant
      bestScore = score
    }
  }
  return best
}

/**
 * The product's options and the way to choose a variant, in one place: one row per option — a tag
 * with the option's name (Size) and a pill per value (Small, Medium, Large), then the next option
 * (Color…) on its own row. **Click a value to choose it**: the chosen value of each option is
 * marked, and the variant with those values is the one shown below (a click on a value that
 * doesn't go with the other choice moves to the nearest variant that has it). **Double-click a
 * name or a value to rename it** (it becomes a box: Enter or leaving it keeps the text, Escape puts
 * the old one back). A change asks "Are you sure?" (old → new) and then sends just
 * `options_update` — `{ name, new_name }` or `{ name, values_rename: [{ from, to }] }` — and the
 * new name shows at once. Adding or removing values is in the editor (**Edit variants**).
 */
export function VariantOptionRows({
  product,
  selected,
  onSelect,
  onSaved,
}: {
  product: ProductDetail
  /** The variant shown now. */
  selected: ProductVariant
  onSelect: (variantId: string) => void
  onSaved?: SavedHandler
}) {
  const { save, error, clearError } = useSaveProduct()
  const [asking, setAsking] = useState<Change | null>(null)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const options = product.has_only_default_variant
    ? []
    : [...product.options].sort((a, b) => a.position - b.position)
  if (options.length === 0) return null

  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  const chosen = (name: string) =>
    selected.selected_options?.find((o) => o.name === name)?.value

  /** Why `to` can't be this option's new name, or null. */
  function nameProblem(option: string, to: string): string | null {
    if (to.length > LIMITS.optionName) {
      return `A name can have at most ${LIMITS.optionName} characters.`
    }
    if (options.some((other) => other.name !== option && same(other.name, to))) {
      return 'Another option already has that name.'
    }
    return null
  }
  /** Why `to` can't be this value's new name, or null. */
  function valueProblem(option: string, from: string, to: string): string | null {
    if (to.length > LIMITS.optionValue) {
      return `A value can have at most ${LIMITS.optionValue} characters.`
    }
    const values = options.find((candidate) => candidate.name === option)?.values ?? []
    if (values.some((value) => value !== from && same(value, to))) {
      return 'This option already has that value.'
    }
    return null
  }

  async function confirm() {
    if (!asking) return
    const change = asking
    setAsking(null)
    setSending(true)
    setFailed(false)
    clearError()
    const body: ProductUpdateBody =
      change.kind === 'name'
        ? { options_update: [{ name: change.option, new_name: change.to }] }
        : {
            options_update: [
              {
                name: change.option,
                values_rename: [{ from: change.from, to: change.to }],
              },
            ],
          }
    const result = await save({ id: product.id, body, shop: product.shop?.key })
    setSending(false)
    if (result) onSaved?.(result, product, body)
    else setFailed(true)
  }

  return (
    <section
      aria-label="Variant options"
      className={`flex flex-col gap-2.5 ${sending ? 'opacity-70' : ''}`}
    >
      {options.map((option) => (
        <div key={option.name} className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <EditablePill
            tag
            text={option.name}
            label={`Name of option ${option.name}`}
            disabled={sending}
            check={(to) => nameProblem(option.name, to)}
            onCommit={(to) => setAsking({ kind: 'name', option: option.name, to })}
          />
          <ul
            aria-label={`Values of ${option.name}`}
            className="m-0 flex list-none flex-wrap gap-1.5 p-0"
          >
            {option.values.map((value) => (
              <li key={value}>
                <EditablePill
                  text={value}
                  label={`Value “${value}” of ${option.name}`}
                  pressed={chosen(option.name) === value}
                  disabled={sending}
                  onPick={() => {
                    const next = variantFor(
                      product.variants,
                      selected,
                      option.name,
                      value,
                    )
                    if (next) onSelect(next.id)
                  }}
                  check={(to) => valueProblem(option.name, value, to)}
                  onCommit={(to) =>
                    setAsking({ kind: 'value', option: option.name, from: value, to })
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {failed && error && (
        <p role="alert" className="text-danger text-[0.78rem]">
          {error}
        </p>
      )}
      {asking !== null && (
        <ConfirmUpdateDialog
          title={`Update “${product.title}”?`}
          change={{
            label:
              asking.kind === 'name'
                ? `Name of the option “${asking.option}”`
                : `Value of ${asking.option}`,
            from: asking.kind === 'name' ? asking.option : asking.from,
            to: asking.to,
          }}
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(null)}
        />
      )}
    </section>
  )
}

/**
 * A name or a value as a pill that tints on hover. A value is chosen with a click (`onPick`,
 * `pressed` marks the chosen one); a double-click (or F2) turns any pill into a box to rename it. A
 * refused name (`check` says why) stays open with the reason under it; nothing is sent from here —
 * `onCommit` hands the new text over.
 */
function EditablePill({
  text,
  label,
  tag = false,
  pressed,
  disabled,
  check,
  onPick,
  onCommit,
}: {
  text: string
  label: string
  /** The option's name (a square tag) rather than one of its values (a round pill). */
  tag?: boolean
  /** The chosen value of its option (values only). */
  pressed?: boolean
  disabled: boolean
  check: (to: string) => string | null
  onPick?: () => void
  onCommit: (to: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const [problem, setProblem] = useState<string | null>(null)
  const shape = tag
    ? 'border-border-strong rounded-md bg-accent-tint px-2.5 py-0.5 text-[0.82rem] font-semibold hover:bg-table-head'
    : pressed
      ? 'rounded-full border-accent bg-accent-tint px-3 py-0.5 text-[0.8rem] font-semibold'
      : 'border-border-strong rounded-full bg-bg px-3 py-0.5 text-[0.8rem] font-medium hover:bg-accent-tint/60'

  function start() {
    setDraft(text)
    setEditing(true)
  }

  function finish() {
    const next = draft.trim()
    if (next === '' || next === text) {
      setEditing(false)
      setProblem(null)
      return
    }
    const message = check(next)
    if (message) {
      setProblem(message)
      return
    }
    setEditing(false)
    setProblem(null)
    onCommit(next)
  }

  if (editing) {
    return (
      <span className="inline-flex flex-col gap-1">
        <input
          autoFocus
          aria-label={label}
          aria-invalid={problem ? true : undefined}
          autoComplete="off"
          value={draft}
          maxLength={LIMITS.optionValue}
          onChange={(event) => {
            setDraft(event.target.value)
            setProblem(null)
          }}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              finish()
            } else if (event.key === 'Escape') {
              event.stopPropagation()
              setEditing(false)
              setProblem(null)
              setDraft(text)
            }
          }}
          className="border-accent bg-bg text-text focus:outline-accent-tint aria-[invalid=true]:border-danger h-8 w-36 rounded-full border px-3 text-[0.8rem] font-medium outline-none focus:outline-2"
        />
        {problem && (
          <span role="alert" className="text-danger text-[0.74rem]">
            {problem}
          </span>
        )}
      </span>
    )
  }

  return (
    <button
      type="button"
      title={
        onPick ? 'Click to choose · double-click to rename' : 'Double-click to rename'
      }
      aria-pressed={onPick ? Boolean(pressed) : undefined}
      disabled={disabled}
      onClick={() => onPick?.()}
      onDoubleClick={start}
      onKeyDown={(event) => {
        if (event.key === 'F2') {
          event.preventDefault()
          start()
        }
      }}
      className={`text-text cursor-pointer border transition-colors disabled:cursor-default ${shape}`}
    >
      {text}
    </button>
  )
}
