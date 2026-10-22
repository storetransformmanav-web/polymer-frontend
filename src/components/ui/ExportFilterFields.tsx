import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from './icons.tsx'

const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-10 w-full min-w-0 rounded-lg border px-3 text-[0.85rem] font-medium transition-colors outline-none focus:outline-2 disabled:opacity-60'

/** The grid the export dialog's filter fields sit in. */
export function ExportFilterGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">{children}</div>
}

interface FieldProps {
  id: string
  label: string
  icon?: ComponentType<IconProps>
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function Label({ id, label, icon: Icon }: Pick<FieldProps, 'id' | 'label' | 'icon'>) {
  return (
    <label
      htmlFor={id}
      className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold"
    >
      {Icon && <Icon width={16} height={16} className="text-text-muted" />}
      {label}
    </label>
  )
}

/** A number box (a price range end) for the export dialog's filters. */
export function ExportNumberField(field: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label {...field} />
      <input
        id={field.id}
        type="number"
        inputMode="decimal"
        min={0}
        placeholder={field.placeholder}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        className={FIELD_INPUT}
      />
    </div>
  )
}
