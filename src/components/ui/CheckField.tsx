/** A small checkbox with its label. */
export function CheckField({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id?: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** A line of explanation under the label. */
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2 text-[0.86rem] font-medium"
      >
        <input
          id={id}
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
