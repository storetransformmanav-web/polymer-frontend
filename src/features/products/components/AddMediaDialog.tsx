import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import {
  type ProductDetail,
  type ProductMediaInput,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { useFileUpload } from '../hooks/useFileUpload.ts'
import { useProductMedia } from '../hooks/useProductMedia.ts'
import {
  blankMedia,
  buildMediaItems,
  LIMITS,
  validateNewMedia,
  type NewMediaDraft,
} from '../utils/editDraft.ts'
import { type PickedFile } from '../utils/mediaFiles.ts'
import { FilePicker } from './FilePicker.tsx'
import { MediaRows } from './MediaRows.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface AddMediaDialogProps {
  product: ProductDetail
  onClose: () => void
  /** The files were accepted (the store is downloading them); `items` is what was sent. */
  onDone: (result: ProductWriteResult, items: ProductMediaInput[]) => void
}

/**
 * "Add media": files **uploaded from your computer** and/or images and videos by a public
 * https address (the store downloads those itself). Nothing is sent until "Add to product".
 * That checks the addresses first (https only, the API's length limits), then uploads the
 * chosen files one by one, and finally attaches everything in one request (at most 20). If a
 * file fails to upload nothing is attached: fix or remove it and press the button again —
 * the files that already went up are not sent twice.
 */
export function AddMediaDialog({ product, onClose, onDone }: AddMediaDialogProps) {
  const { add, isAdding, error } = useProductMedia(product)
  const { upload, states } = useFileUpload()
  const [rows, setRows] = useState<NewMediaDraft[]>(() => [blankMedia()])
  const [files, setFiles] = useState<PickedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProblem, setUploadProblem] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  // With files chosen, the empty address row is just not used.
  const rowsUsed = rows.some((row) => row.url.trim() !== '' || row.alt.trim() !== '')
  const problems = files.length > 0 && !rowsUsed ? {} : validateNewMedia(rows)
  const addresses = buildMediaItems(rows).length
  if (addresses + files.length > LIMITS.newMedia) {
    problems.rows = `You can add at most ${LIMITS.newMedia} files at a time`
  }
  const visible = showErrors ? problems : {}
  const busy = isAdding || uploading

  async function submit() {
    setShowErrors(true)
    setUploadProblem(null)
    if (Object.keys(problems).length > 0) return
    let uploaded: ProductMediaInput[] = []
    if (files.length > 0) {
      setUploading(true)
      const outcome = await upload(product.id, product.shop?.key, files)
      setUploading(false)
      if (outcome.failed > 0) {
        setUploadProblem(
          `${outcome.failed === 1 ? '1 file' : `${outcome.failed} files`} could not be uploaded. Remove ${outcome.failed === 1 ? 'it' : 'them'} or press “Add to product” to try again — nothing has been added yet.`,
        )
        return
      }
      uploaded = outcome.items
    }
    const items = [...buildMediaItems(rows), ...uploaded]
    const result = await add(items)
    if (result) onDone(result, items)
  }

  return (
    <Dialog
      title="Add media"
      role="dialog"
      wide
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`}
          >
            {busy && <SpinnerIcon width={14} height={14} className="animate-spin" />}
            {uploading ? 'Uploading…' : 'Add to product'}
          </button>
        </>
      }
    >
      <p>
        Upload images, videos or 3D models from your computer, or add an image or video by
        its public web address. The store processes the files, so they appear in the
        product a moment after you add them.
      </p>

      <FilePicker
        files={files}
        onChange={setFiles}
        max={Math.max(0, LIMITS.newMedia - addresses)}
        states={states}
        disabled={busy}
        idPrefix="add-media"
      />

      <MediaRows
        rows={rows}
        onChange={setRows}
        errors={visible}
        max={LIMITS.newMedia}
        idPrefix="add-media"
        autoFocusFirst={files.length === 0}
      />

      {visible.rows && <FormMessage tone="error">{visible.rows}</FormMessage>}
      {uploadProblem && <FormMessage tone="error">{uploadProblem}</FormMessage>}
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </Dialog>
  )
}
