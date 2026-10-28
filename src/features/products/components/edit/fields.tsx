import type { ReactNode } from 'react'
import type { ProductDetail } from '../../../../lib/api/endpoints.ts'
import type { DraftErrors, ProductDraft } from '../../utils/editDraft.ts'

/** What every section of the edit form receives. */
export interface SectionProps {
  /** The product as it was when the form opened. */
  product: ProductDetail
  draft: ProductDraft
  errors: DraftErrors
  onChange: (patch: Partial<ProductDraft>) => void
}

export const FIELD_LABEL = 'text-text text-[0.82rem] font-semibold'
export const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint placeholder:text-text-muted/70 h-10 w-full min-w-0 rounded-lg border px-3 text-[0.88rem] font-medium transition-colors outline-none focus:outline-2 aria-[invalid=true]:border-danger disabled:opacity-60'
export const FIELD_TEXTAREA =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint placeholder:text-text-muted/70 min-h-24 w-full min-w-0 resize-y rounded-lg border px-3 py-2.5 text-[0.88rem] leading-relaxed font-medium transition-colors outline-none focus:outline-2 aria-[invalid=true]:border-danger'

interface EditFieldProps {
  id: string
  label: string
  /** The problem with this field, if any. */
  error?: string | null
  hint?: string
  optional?: boolean
  /** "12 / 70" — characters used out of the limit. */
  counter?: { value: number; max: number }
  children: ReactNode
}

/** A labelled form field with its hint, character counter and error message. */
export function EditField({
  id,
  label,
  error,
  hint,
  optional,
  counter,
  children,
}: EditFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
          {optional && <span className="text-text-muted font-normal"> (optional)</span>}
        </label>
        {counter && (
          <span
            className={`text-[0.72rem] tabular-nums ${
              counter.value > counter.max
                ? 'text-danger font-semibold'
                : 'text-text-muted'
            }`}
          >
            {counter.value} / {counter.max}
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-text-muted text-[0.76rem]">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger text-[0.78rem]">
          {error}
        </p>
      )}
    </div>
  )
}

/** A small checkbox with its label. */
export function CheckField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** A line of explanation under the label. */
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-center gap-2 text-[0.86rem] font-medium">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="accent-accent h-4 w-4 shrink-0 cursor-pointer"
        />
        {label}
      </label>
      {hint && <p className="text-text-muted pl-6 text-[0.76rem]">{hint}</p>}
    </div>
  )
}

/** A small icon-only button (move, remove...). */
export const ICON_BUTTON =
  'text-text-muted hover:text-text hover:bg-surface inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent transition-colors disabled:pointer-events-none disabled:opacity-40'

/** A quiet text button ("Undo", "Add…"). */
export const TEXT_BUTTON =
  'text-accent hover:text-accent-hover inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[0.82rem] font-semibold transition-colors'
