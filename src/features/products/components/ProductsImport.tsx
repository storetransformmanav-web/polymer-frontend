import { useMemo, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import {
  CheckCircleIcon,
  SpinnerIcon,
  UploadIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import type { SelectOption } from '../../../components/ui/SelectField.tsx'
import { useShops } from '../../../hooks/useShops.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { useProductsImport } from '../hooks/useProductsImport.ts'
import { useRefreshProductList } from '../hooks/useRefreshProductList.ts'
import { buildSampleImportCsv, SAMPLE_IMPORT_FILENAME } from '../utils/importCsv.ts'
import { ImportPickStep } from './import/ImportPickStep.tsx'
import { ImportProgressStep } from './import/ImportProgressStep.tsx'
import { ImportReviewStep } from './import/ImportReviewStep.tsx'
import { formatNumber } from './import/importFormat.ts'

interface ProductsImportProps {
  /** Show the button (the list is on screen); the progress and the dialogs stay either way. */
  visible?: boolean
}

/**
 * The **Import** button, in the top bar beside Export (`InAppBar`), the three screens it opens
 * (`ImportPickStep` → `ImportReviewStep` → `ImportProgressStep`), and — once an import has
 * started — its progress in the bar, which stays after the window is closed: the import runs
 * on the server, and when it ends the products list re-reads itself. See `useProductsImport`
 * for the flow and `POST /products/import` for the request.
 */
export function ProductsImport({ visible = true }: ProductsImportProps) {
  const { shops, selected } = useShops()
  const refreshList = useRefreshProductList()
  const [open, setOpen] = useState(false)

  // The stores a file can be imported into; the one picked in the top bar (or the first) is the default.
  const usable = useMemo(() => {
    const live = shops.filter((shop) => shop.connected && shop.is_active)
    return live.length > 0 ? live : shops
  }, [shops])
  const shopOptions: SelectOption[] = usable.map((shop) => ({
    value: shopValue(shop),
    label: shopLabel(shop),
  }))
  const defaultShop = selected !== ALL_SHOPS ? selected : (shopOptions[0]?.value ?? '')

  const importer = useProductsImport({
    defaultShop,
    onFinished: () => refreshList(true),
  })
  const { phase, choice, outcome, progress } = importer
  const going = phase === 'starting' || phase === 'running'
  const chosenShop = shopOptions.find((option) => option.value === choice.shop)
  const currency = shops.find((shop) => shopValue(shop) === choice.shop)?.currency ?? null

  function openDialog() {
    if (phase === 'finished') importer.reset()
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    // A file chosen but not sent is forgotten; a running or finished import is kept (it is in the bar).
    if (phase === 'pick' || phase === 'review') importer.reset()
  }

  function downloadSample() {
    downloadBlob(
      SAMPLE_IMPORT_FILENAME,
      new Blob([buildSampleImportCsv()], { type: 'text/csv;charset=utf-8' }),
    )
  }

  return (
    <>
      <InAppBar>
        {(going || phase === 'finished') && (
          <div
            role="status"
            aria-live="polite"
            className="flex max-w-[18rem] min-w-0 items-center gap-2 text-[0.82rem]"
          >
            {going ? (
              <>
                <SpinnerIcon
                  width={14}
                  height={14}
                  className="text-accent animate-spin"
                />
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
              onClick={() => setOpen(true)}
              className="text-accent cursor-pointer border-none bg-transparent p-0 font-semibold hover:underline"
            >
              View
            </button>
            {phase === 'finished' && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={importer.reset}
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
            onClick={openDialog}
            className="border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.85rem] font-semibold transition-colors"
          >
            <UploadIcon width={16} height={16} />
            Import
          </button>
        )}
      </InAppBar>

      {open && (phase === 'pick' || phase === 'checking') && (
        <ImportPickStep
          file={importer.file}
          summary={importer.summary}
          fileError={importer.fileError}
          error={importer.error}
          shopOptions={shopOptions}
          choice={choice}
          onChoice={importer.setChoice}
          onFile={(file) => void importer.chooseFile(file)}
          onDownloadSample={downloadSample}
          canUpload={importer.canCheck}
          checking={phase === 'checking'}
          onUpload={() => void importer.check()}
          onClose={closeDialog}
        />
      )}

      {open && (phase === 'review' || phase === 'starting') && importer.summary && (
        <ImportReviewStep
          summary={importer.summary}
          plan={importer.checkPlan}
          choice={choice}
          shopLabel={chosenShop?.label ?? choice.shop}
          currency={currency}
          starting={phase === 'starting'}
          error={importer.error}
          onChooseAnother={importer.backToPick}
          onImport={() => void importer.start()}
          onClose={closeDialog}
        />
      )}

      {open && (phase === 'running' || phase === 'finished') && (
        <ImportProgressStep outcome={outcome} progress={progress} onClose={closeDialog} />
      )}
    </>
  )
}
