/**
 * An on/off toggle (a real `role="switch"` button) with its label beside it — generic,
 * for settings that are a plain yes/no ("Inventory tracked", "Physical product").
 */
export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="text-text-muted text-[0.78rem] font-medium" aria-hidden="true">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`focus-visible:outline-accent relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-none p-0 transition-colors focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-50 ${
          checked ? 'bg-text' : 'bg-border-strong'
        }`}
      >
        <span
          aria-hidden="true"
          className={`bg-bg absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </span>
  )
}
