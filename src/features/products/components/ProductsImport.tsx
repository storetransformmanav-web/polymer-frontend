import { useState } from 'react'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import { ImportBarControls } from '../../../components/ui/csvImport/ImportBarControls.tsx'
import { formatNumber } from '../../../components/ui/csvImport/importFormat.ts'
import {
  ImportPickStep,
  type ImportPickWording,
} from '../../../components/ui/csvImport/ImportPickStep.tsx'
import { ImportProgressStep } from '../../../components/ui/csvImport/ImportProgressStep.tsx'
import { useImportStores } from '../../../hooks/useImportStores.ts'
import { shopValue } from '../../../app/store/shopSlice.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { useProductsImport } from '../hooks/useProductsImport.ts'
import { useRefreshProductList } from '../hooks/useRefreshProductList.ts'
import { buildSampleImportCsv, SAMPLE_IMPORT_FILENAME } from '../utils/importCsv.ts'
import { ImportReviewStep } from './import/ImportReviewStep.tsx'

interface ProductsImportProps {
  /** Show the button (the list is on screen); the progress and the dialogs stay either way. */
  visible?: boolean
}

const WORDING: ImportPickWording = {
  title: 'Import products',
  intro: 'Import a CSV file that’s already formatted to fit Shopify’s template.',
  dropHint: 'A CSV in Shopify’s product layout (one row per variant), up to 25 MB.',
  overwriteLabel: 'Overwrite products with matching handles.',
  overwriteHint: 'Existing values will be replaced for all columns included in the CSV.',
  createLabel: 'Create new products.',
  createHint: 'Products whose handle isn’t in the store yet will be added.',
  nothingToDo: 'Choose at least one: overwrite existing products, or create new ones.',
}

/**
 * The **Import** button, in the top bar beside Export (`InAppBar`), the three screens it opens
 * (`ImportPickStep` → `ImportReviewStep` → `ImportProgressStep`), and — once an import has
 * started — its progress in the bar, which stays after the window is closed: the import runs
 * on the server, and when it ends the products list re-reads itself. See `useProductsImport`
 * for the flow and `POST /products/import` for the request.
 */
export function ProductsImport({ visible = true }: ProductsImportProps) {
  const { shops, shopOptions, defaultShop } = useImportStores()
  const refreshList = useRefreshProductList()
  const [open, setOpen] = useState(false)

  const importer = useProductsImport({
    defaultShop,
    onFinished: () => refreshList(true),
  })
  const { phase, choice, outcome, progress } = importer
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
        <ImportBarControls
          phase={phase}
          outcome={outcome}
          progress={progress}
          visible={visible}
          onOpen={openDialog}
          onView={() => setOpen(true)}
          onDismiss={importer.reset}
        />
      </InAppBar>

      {open && (phase === 'pick' || phase === 'checking') && (
        <ImportPickStep
          wording={WORDING}
          file={importer.file}
          fileSummary={
            importer.summary &&
            `${formatNumber(importer.summary.products)} ${
              importer.summary.products === 1 ? 'product' : 'products'
            }`
          }
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
        <ImportProgressStep
          noun="products"
          outcome={outcome}
          progress={progress}
          onClose={closeDialog}
        />
      )}
    </>
  )
}
