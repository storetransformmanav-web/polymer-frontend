import { useState } from 'react'
import type { ProductDetail, ProductUpdateBody } from '../../../lib/api/endpoints.ts'
import { useSaveProduct } from '../hooks/useSaveProduct.ts'
import type { SavedHandler } from '../hooks/useSectionEdit.ts'
import { LIMITS } from '../utils/editDraft.ts'
import { ConfirmUpdateDialog } from './ConfirmUpdateDialog.tsx'

type Change =
  | { kind: 'name'; option: string; to: string }
  | { kind: 'value'; option: string; from: string; to: string }

/**
 * The product's options, one row each — a tag with the option's name (Size) and a pill per value
 * (Small, Medium, Large), then the next option (Color…) on its own row. **Hover a name or a value,
 * click it, and it becomes a box**: Enter (or leaving the box) keeps what was typed, Escape puts
 * the old one back. A change asks "Are you sure?" (old → new) and then sends just
 * `options_update` — `{ name, new_name }` or `{ name, values_rename: [{ from, to }] }` — and the
 * new name shows at once, in the table below too. Adding or removing values is in the editor
 * (**Edit variants**).
 */
export function VariantOptionsCard({
  product,
  onSaved,
}: {
  product: ProductDetail
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
      className={`flex flex-col gap-3 px-1 ${sending ? 'opacity-70' : ''}`}
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
          <ul aria-label={`Values of ${option.name}`} className="flex flex-wrap gap-1.5">
            {option.values.map((value) => (
              <li key={value}>
                <EditablePill
                  text={value}
                  label={`Value “${value}” of ${option.name}`}
                  disabled={sending}
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
 * A name or a value as a pill that tints on hover; one click turns it into a box. A refused value
 * (`check` says why) stays open with the reason under it; nothing is sent from here — `onCommit`
 * hands the new text over.
 */
function EditablePill({
  text,
  label,
  tag = false,
  disabled,
  check,
  onCommit,
}: {
  text: string
  label: string
  /** The option's name (a square tag) rather than one of its values (a round pill). */
  tag?: boolean
  disabled: boolean
  check: (to: string) => string | null
  onCommit: (to: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const [problem, setProblem] = useState<string | null>(null)
  const shape = tag
    ? 'rounded-md bg-accent-tint px-2.5 py-0.5 text-[0.82rem] font-semibold hover:bg-table-head'
    : 'rounded-full bg-bg px-3 py-0.5 text-[0.8rem] font-medium hover:bg-accent-tint/60'

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
      title="Click to rename"
      disabled={disabled}
      onClick={() => {
        setDraft(text)
        setEditing(true)
      }}
      className={`border-border-strong text-text cursor-text border transition-colors disabled:cursor-default ${shape}`}
    >
      {text}
    </button>
  )
}
