import { BADGE_TONE_CLASSES } from '../../../components/ui/badgeTones.ts'
import { ChevronDownIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import {
  PRODUCT_EDIT_STATUSES,
  type ProductEditStatus,
} from '../../../lib/api/endpoints.ts'
import { statusLabel, statusTone } from '../utils/format.ts'

interface ProductStatusSelectProps {
  /** The product's name, for the control's accessible name. */
  title: string
  /** The status to show (the one being saved, while a save is in flight). */
  value: string | null
  saving: boolean
  /** The backend's message when the last change failed. */
  error?: string
  onChange: (status: ProductEditStatus) => void
}

/**
 * A product's status as a dropdown that looks like the status pill: pick a
 * status and it is saved at once. Only the statuses the API can set are
 * offered; one it cannot set (Unlisted) is shown, but can only be moved away from.
 */
export function ProductStatusSelect({
  title,
  value,
  saving,
  error,
  onChange,
}: ProductStatusSelectProps) {
  const current = (value ?? '').toUpperCase()
  const known = PRODUCT_EDIT_STATUSES.some((status) => status === current)

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="relative inline-flex items-center">
        <select
          aria-label={`Status of ${title}`}
          aria-invalid={error ? true : undefined}
          value={current}
          disabled={saving}
          onChange={(event) => onChange(event.target.value as ProductEditStatus)}
          className={`focus-visible:outline-accent cursor-pointer appearance-none rounded-full border-none py-0.5 pr-7 pl-2.5 text-xs font-semibold outline-none focus-visible:outline-2 disabled:cursor-progress disabled:opacity-70 ${BADGE_TONE_CLASSES[statusTone(current)]}`}
        >
          {!known && (
            <option value={current} disabled>
              {statusLabel(current)}
            </option>
          )}
          {PRODUCT_EDIT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
        {saving ? (
          <SpinnerIcon
            width={12}
            height={12}
            className="pointer-events-none absolute right-2 animate-spin"
          />
        ) : (
          <ChevronDownIcon
            width={12}
            height={12}
            className="pointer-events-none absolute right-2"
          />
        )}
      </div>
      {error && (
        <span
          role="alert"
          className="text-danger max-w-40 text-[0.7rem] leading-tight whitespace-normal"
        >
          {error}
        </span>
      )}
    </div>
  )
}
