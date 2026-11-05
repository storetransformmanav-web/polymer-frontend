import { useState } from 'react'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import { ImportBarControls } from '../../../components/ui/csvImport/ImportBarControls.tsx'
import { formatNumber } from '../../../components/ui/csvImport/importFormat.ts'
import {
  ImportPickStep,
  type ImportPickWording,
} from '../../../components/ui/csvImport/ImportPickStep.tsx'
import { ImportProgressStep } from '../../../components/ui/csvImport/ImportProgressStep.tsx'
import { useCsvImport, type CsvImportSource } from '../../../hooks/useCsvImport.ts'
import { useImportStores } from '../../../hooks/useImportStores.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { useRefreshCustomerList } from '../hooks/useRefreshCustomerList.ts'
import {
  buildSampleCustomerCsv,
  SAMPLE_CUSTOMER_IMPORT_FILENAME,
  summarizeCustomerCsv,
  type CustomerImportSummary,
} from '../utils/importCsv.ts'
import { CustomerImportReviewStep } from './CustomerImportReviewStep.tsx'

const CUSTOMERS_IMPORT: CsvImportSource<CustomerImportSummary> = {
  queryKey: 'customer-import',
  noun: 'customers',
  layout: 'Shopify’s customer layout',
  summarize: summarizeCustomerCsv,
  send: (file, options) => api.customers.import(file, options),
  status: (importId) => api.customers.importStatus(importId),
}

const WORDING: ImportPickWording = {
  title: 'Import customers',
  intro: 'Import a CSV file that’s already formatted to fit Shopify’s template.',
  dropHint: 'A CSV in Shopify’s customer layout (one row per customer), up to 25 MB.',
  overwriteLabel: 'Overwrite customers with matching emails.',
  overwriteHint: 'Existing values will be replaced for all columns included in the CSV.',
  createLabel: 'Create new customers.',
  createHint: 'Customers whose email isn’t in the store yet will be added.',
  nothingToDo: 'Choose at least one: overwrite existing customers, or create new ones.',
}

/**
 * The **Import** button, in the top bar beside Export (`InAppBar`), the three screens it opens
 * (`ImportPickStep` → `CustomerImportReviewStep` → `ImportProgressStep`), and — once an import
 * has started — its progress in the bar, which stays after the window is closed: the import
 * runs on the server, and when it ends the customers list re-reads itself. See `useCsvImport`
 * for the flow and `POST /customer/import` for the request.
 */
export function CustomersImport({ visible = true }: { visible?: boolean }) {
  const { shopOptions, defaultShop } = useImportStores()
  const refreshList = useRefreshCustomerList()
  const [open, setOpen] = useState(false)

  const importer = useCsvImport({
    source: CUSTOMERS_IMPORT,
    defaultShop,
    onFinished: () => refreshList(true),
  })
  const { phase, choice, outcome, progress, summary } = importer
  const chosenShop = shopOptions.find((option) => option.value === choice.shop)

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
      SAMPLE_CUSTOMER_IMPORT_FILENAME,
      new Blob([buildSampleCustomerCsv()], { type: 'text/csv;charset=utf-8' }),
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
            summary &&
            `${formatNumber(summary.customers)} ${
              summary.customers === 1 ? 'customer' : 'customers'
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

      {open && (phase === 'review' || phase === 'starting') && summary && (
        <CustomerImportReviewStep
          summary={summary}
          plan={importer.checkPlan}
          choice={choice}
          shopLabel={chosenShop?.label ?? choice.shop}
          starting={phase === 'starting'}
          error={importer.error}
          onChooseAnother={importer.backToPick}
          onImport={() => void importer.start()}
          onClose={closeDialog}
        />
      )}

      {open && (phase === 'running' || phase === 'finished') && (
        <ImportProgressStep
          noun="customers"
          outcome={outcome}
          progress={progress}
          onClose={closeDialog}
        />
      )}
    </>
  )
}
