import { Dialog } from '../../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../../components/ui/icons.tsx'
import type { ProductImportProgress } from '../../../../lib/api/productImport.ts'
import type { ImportOutcome } from '../../hooks/useProductsImport.ts'
import { CountChips, ImportProblems } from './importUi.tsx'
import { BUTTON_PRIMARY, formatNumber } from './importFormat.ts'

interface ImportProgressStepProps {
  /** null while the import is still going; how it ended once it has. */
  outcome: ImportOutcome | null
  /** The latest progress answer (null before the first). */
  progress: ProductImportProgress | null
  onClose: () => void
}

const TITLES: Record<ImportOutcome['kind'], string> = {
  done: 'Import finished',
  failed: 'The import ran into a problem',
  sent: 'Import in progress',
  timeout: 'Import in progress',
}

/**
 * The third screen: while the import runs on the server, how far it is (the bar and figures
 * from `GET /products/import/{import_id}`); when it has ended, how it went — and the rows that
 * were skipped, with the reason for each. The window can be closed at any time: the import
 * carries on, and the products list re-reads itself when it ends.
 */
export function ImportProgressStep({
  outcome,
  progress,
  onClose,
}: ImportProgressStepProps) {
  const processed = progress?.processed ?? null
  const total = progress?.total ?? null
  const percent =
    processed !== null && total !== null && total > 0
      ? Math.min(100, Math.round((processed / total) * 100))
      : null

  return (
    <Dialog
      title={outcome ? TITLES[outcome.kind] : 'Importing products'}
      role="dialog"
      wide
      closeButton
      onClose={onClose}
      footer={
        <button type="button" data-autofocus onClick={onClose} className={BUTTON_PRIMARY}>
          Close
        </button>
      }
    >
      {outcome === null ? (
        <>
          <div role="status" className="text-text flex items-center gap-3 text-[0.9rem]">
            <SpinnerIcon width={18} height={18} className="text-accent animate-spin" />
            <p>
              Importing your products…
              {processed !== null &&
                total !== null &&
                ` ${formatNumber(processed)} of ${formatNumber(total)}`}
            </p>
          </div>
          {percent !== null && (
            <div
              role="progressbar"
              aria-label="Import progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="bg-surface h-2 overflow-hidden rounded-full"
            >
              <div
                className="bg-accent h-full rounded-full transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
          {progress && <CountChips counts={progress.counts} />}
          <p className="text-[0.82rem]">
            You can close this window. The import carries on in the background, and the
            products list refreshes when it finishes.
          </p>
        </>
      ) : (
        <>
          <FormMessage
            tone={
              outcome.kind === 'done'
                ? 'success'
                : outcome.kind === 'failed'
                  ? 'error'
                  : 'info'
            }
          >
            {outcome.message}
          </FormMessage>
          {progress && <CountChips counts={progress.counts} />}
          {progress && (
            <ImportProblems
              title={`${formatNumber(progress.problems.length)} ${
                progress.problems.length === 1 ? 'row was' : 'rows were'
              } skipped`}
              problems={progress.problems}
              max={20}
            />
          )}
        </>
      )}
    </Dialog>
  )
}
