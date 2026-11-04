import { StatusSelect } from '../../../components/ui/StatusSelect.tsx'
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
 * A product's status as a pill with a dropdown (the shared `StatusSelect`): every status keeps
 * its colour in the menu too — Active green, Draft grey, Archived red — so the choice reads the
 * same as the result. Only the statuses the API can set are offered; one it cannot set
 * (Unlisted) is shown, but can only be moved away from.
 */
export function ProductStatusSelect({
  title,
  value,
  saving,
  error,
  onChange,
}: ProductStatusSelectProps) {
  const current = (value ?? '').toUpperCase()
  const options = [
    ...(PRODUCT_EDIT_STATUSES.some((status) => status === current) || !current
      ? []
      : [{ value: current, disabled: true }]),
    ...PRODUCT_EDIT_STATUSES.map((status) => ({ value: status, disabled: false })),
  ].map((option) => ({
    ...option,
    label: statusLabel(option.value),
    tone: statusTone(option.value),
  }))

  return (
    <StatusSelect
      title={title}
      value={current}
      valueLabel={statusLabel(current)}
      valueTone={statusTone(current)}
      options={options}
      saving={saving}
      error={error}
      onChange={(status) => onChange(status as ProductEditStatus)}
    />
  )
}
