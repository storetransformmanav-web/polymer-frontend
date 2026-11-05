import { useRef, useState, type DragEvent } from 'react'
import type { ImportChoice } from '../../../hooks/useCsvImport.ts'
import { CheckField } from '../CheckField.tsx'
import { Dialog } from '../Dialog.tsx'
import { FormMessage } from '../FormMessage.tsx'
import { PaperclipIcon, SpinnerIcon } from '../icons.tsx'
import { SelectField, type SelectOption } from '../SelectField.tsx'
import { BUTTON_PLAIN, BUTTON_PRIMARY, formatBytes } from './importFormat.ts'

/** What this screen says about the records being imported. */
export interface ImportPickWording {
  /** The window's title: "Import products". */
  title: string
  /** The line above the file box, before the sample link. */
  intro: string
  /** The small line in the drop area. */
  dropHint: string
  overwriteLabel: string
  overwriteHint: string
  createLabel: string
  createHint: string
  /** Shown when neither choice is ticked. */
  nothingToDo: string
}

interface ImportPickStepProps {
  wording: ImportPickWording
  file: File | null
  /** What the file holds once it has been read ("12 products"); null while it is being read. */
  fileSummary: string | null
  /** Why the file can't be used. */
  fileError: string | null
  /** A failed check's message (the backend's). */
  error: string | null
  shopOptions: SelectOption[]
  choice: ImportChoice
  onChoice: (patch: Partial<ImportChoice>) => void
  onFile: (file: File | null) => void
  onDownloadSample: () => void
  canUpload: boolean
  /** The store is reading the file (the check). */
  checking: boolean
  onUpload: () => void
  onClose: () => void
}

/**
 * The first screen: where the file comes from (an "Add file" button or a drop), the store it
 * is for, and two choices — overwrite the records that already exist, and create the ones that
 * don't. Nothing is sent until "Upload file", which asks the store to check the file
 * (`dry_run`) before the preview is shown.
 */
export function ImportPickStep({
  wording,
  file,
  fileSummary,
  fileError,
  error,
  shopOptions,
  choice,
  onChoice,
  onFile,
  onDownloadSample,
  canUpload,
  checking,
  onUpload,
  onClose,
}: ImportPickStepProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const nothingToDo = !choice.createNew && !choice.updateExisting

  function take(files: FileList | File[] | null) {
    const first = files?.[0]
    if (first && !checking) onFile(first)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    take(event.dataTransfer.files)
  }

  return (
    <Dialog
      title={wording.title}
      role="dialog"
      wide
      closeButton
      onClose={onClose}
      closeDisabled={checking}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={checking}
            className={BUTTON_PLAIN}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={!canUpload || checking}
            className={BUTTON_PRIMARY}
          >
            {checking && <SpinnerIcon width={14} height={14} className="animate-spin" />}
            {checking ? 'Checking the file…' : 'Upload file'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-text text-[1rem] font-semibold">Bulk import via CSV</h3>
        <p className="text-[0.85rem]">
          {wording.intro}{' '}
          <button
            type="button"
            onClick={onDownloadSample}
            className="text-accent hover:text-accent-hover cursor-pointer border-none bg-transparent p-0 font-medium underline"
          >
            Download sample CSV
          </button>
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label="Choose a CSV file"
        className="sr-only"
        disabled={checking}
        onChange={(event) => {
          take(event.target.files)
          // The same file can then be chosen again after a change to it.
          event.target.value = ''
        }}
      />

      {file ? (
        <div className="border-border flex items-stretch overflow-hidden rounded-xl border">
          <div className="bg-surface text-text border-border flex w-16 shrink-0 items-center justify-center border-r">
            <PaperclipIcon width={20} height={20} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-4">
            <p
              className="text-text truncate text-[0.88rem] font-medium"
              title={file.name}
            >
              {file.name}
            </p>
            <p className="text-[0.78rem]">
              {formatBytes(file.size)}
              {fileSummary ? ` · ${fileSummary}` : ' · reading…'}
            </p>
          </div>
          <div className="flex items-center pr-3">
            <button
              type="button"
              disabled={checking}
              onClick={() => input.current?.click()}
              className="bg-surface text-text hover:bg-accent-tint inline-flex h-9 cursor-pointer items-center rounded-lg border-none px-3.5 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              Replace file
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault()
            if (!checking) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors ${
            dragging
              ? 'border-accent bg-accent-tint/60'
              : 'border-border-strong bg-surface/30'
          }`}
        >
          <button
            type="button"
            data-autofocus
            onClick={() => input.current?.click()}
            className="border-border bg-bg text-text hover:border-accent inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-[0.85rem] font-semibold transition-colors"
          >
            <PaperclipIcon width={16} height={16} />
            Add file
          </button>
          <p className="text-[0.8rem]">or drop a CSV file here</p>
          <p className="text-[0.74rem]">{wording.dropHint}</p>
        </div>
      )}

      {fileError && <FormMessage tone="error">{fileError}</FormMessage>}

      <SelectField
        id="import-shop"
        label="Store"
        value={choice.shop}
        options={
          shopOptions.length > 0
            ? shopOptions
            : [{ value: '', label: 'No stores available' }]
        }
        onChange={(shop) => onChoice({ shop })}
        disabled={checking}
      />

      <div className="text-text flex flex-col gap-3">
        <CheckField
          label={wording.overwriteLabel}
          hint={wording.overwriteHint}
          checked={choice.updateExisting}
          onChange={(updateExisting) => onChoice({ updateExisting })}
        />
        <CheckField
          label={wording.createLabel}
          hint={wording.createHint}
          checked={choice.createNew}
          onChange={(createNew) => onChoice({ createNew })}
        />
        {nothingToDo && (
          <p role="alert" className="text-danger text-[0.8rem]">
            {wording.nothingToDo}
          </p>
        )}
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
