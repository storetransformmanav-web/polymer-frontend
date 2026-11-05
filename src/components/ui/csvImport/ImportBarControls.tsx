import type { ImportOutcome, ImportPhase } from '../../../hooks/useCsvImport.ts'
import type { ProductImportProgress } from '../../../lib/api/productImport.ts'
import { CheckCircleIcon, SpinnerIcon, UploadIcon, XIcon } from '../icons.tsx'
import { formatNumber } from './importFormat.ts'

/**
 * What an import puts in the top bar: its progress, which stays after the window is closed
 * (with **View** to reopen it, and a ✕ once it has ended), and the **Import** button.
 */
export function ImportBarControls({
  phase,
  outcome,
  progress,
  visible,
  onOpen,
  onView,
  onDismiss,
}: {
  phase: ImportPhase
  outcome: ImportOutcome | null
  progress: ProductImportProgress | null
  /** Show the button (the list is on screen). */
  visible: boolean
  onOpen: () => void
  onView: () => void
  onDismiss: () => void
}) {
  const going = phase === 'starting' || phase === 'running'
  return (
    <>
      {(going || phase === 'finished') && (
        <div
          role="status"
          aria-live="polite"
          className="flex max-w-[18rem] min-w-0 items-center gap-2 text-[0.82rem]"
        >
          {going ? (
            <>
              <SpinnerIcon width={14} height={14} className="text-accent animate-spin" />
              <span className="text-text-muted truncate">
                Importing…
                {progress?.processed != null &&
                  progress.total != null &&
                  ` ${formatNumber(progress.processed)} of ${formatNumber(progress.total)}`}
              </span>
            </>
          ) : (
            <>
              {outcome?.kind === 'done' && (
                <CheckCircleIcon
                  width={14}
                  height={14}
                  className="text-accent shrink-0"
                />
              )}
              <span
                className={`truncate ${outcome?.kind === 'failed' ? 'text-danger' : 'text-text-muted'}`}
                title={outcome?.message}
              >
                {outcome?.kind === 'done'
                  ? 'Import finished'
                  : outcome?.kind === 'failed'
                    ? 'Import failed'
                    : 'Import in progress'}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={onView}
            className="text-accent cursor-pointer border-none bg-transparent p-0 font-semibold hover:underline"
          >
            View
          </button>
          {phase === 'finished' && (
            <button
              type="button"
              aria-label="Dismiss"
              onClick={onDismiss}
              className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0"
            >
              <XIcon width={14} height={14} />
            </button>
          )}
        </div>
      )}
      {visible && (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onOpen}
          className="border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.85rem] font-semibold transition-colors"
        >
          <UploadIcon width={16} height={16} />
          Import
        </button>
      )}
    </>
  )
}
