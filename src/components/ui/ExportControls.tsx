import { CheckCircleIcon, DownloadIcon, SpinnerIcon, XIcon } from './icons.tsx'

/** The state of an export, as `useTableExport` reports it. */
interface ExportProgress {
  status: 'idle' | 'running' | 'done' | 'error'
  done: number
  total: number
  message: string
}

const number = (value: number) => value.toLocaleString('en-GB')

/**
 * Beside the Export button: "Exporting… 100 of 250" with Cancel while every page is
 * being read, then the result (or the backend's message, which can be dismissed).
 */
export function ExportStatus({
  state,
  onCancel,
  onDismiss,
}: {
  state: ExportProgress
  onCancel: () => void
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 text-[0.82rem]"
    >
      {state.status === 'running' && (
        <>
          <SpinnerIcon width={14} height={14} className="text-accent animate-spin" />
          <span className="text-text-muted">
            Exporting…{' '}
            {state.total > 0 && `${number(state.done)} of ${number(state.total)}`}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="text-accent cursor-pointer border-none bg-transparent p-0 font-semibold hover:underline"
          >
            Cancel
          </button>
        </>
      )}
      {state.status === 'done' && (
        <>
          <CheckCircleIcon width={14} height={14} className="text-accent shrink-0" />
          <span className="text-text-muted truncate">{state.message}</span>
        </>
      )}
      {state.status === 'error' && (
        <>
          <span className="text-danger">{state.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0"
          >
            <XIcon width={14} height={14} />
          </button>
        </>
      )}
    </div>
  )
}

/** The **Export** button that opens the export dialog. */
export function ExportButton({
  disabled,
  onClick,
}: {
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onClick}
      className="border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
    >
      <DownloadIcon width={16} height={16} />
      Export
    </button>
  )
}
