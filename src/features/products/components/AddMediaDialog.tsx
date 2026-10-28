import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import type { ProductDetail, ProductWriteResult } from '../../../lib/api/endpoints.ts'
import { useAddLocalMedia } from '../hooks/useLocalMedia.ts'
import { LIMITS } from '../utils/editDraft.ts'
import type { PickedFile } from '../utils/mediaFiles.ts'
import { FilePicker } from './FilePicker.tsx'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

interface AddMediaDialogProps {
  product: ProductDetail
  /** How many images the product will have once everything already on its way has arrived. */
  baseline: number
  onClose: () => void
  /** The store accepted the files (called later, once the upload is through). */
  onSent?: (result: ProductWriteResult) => void
}

/**
 * "Add media": files chosen from the computer (images, videos, 3D models). There is no web
 * address option. "Add to product" closes the dialog at once: the files appear in the Media
 * tab straight away, from their own previews, and go up in the background — a file that
 * fails is marked on its tile with the reason and a way to try again.
 */
export function AddMediaDialog({
  product,
  baseline,
  onClose,
  onSent,
}: AddMediaDialogProps) {
  const { start } = useAddLocalMedia()
  const [files, setFiles] = useState<PickedFile[]>([])
  function submit() {
    if (files.length === 0) return
    start(
      {
        id: product.id,
        shop: product.shop?.key,
        baseline,
      },
      files,
      onSent,
    )
    // The tiles made their own previews; the picker lets go of its own as the dialog closes.
    onClose()
  }

  return (
    <Dialog
      title="Add media"
      role="dialog"
      wide
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={files.length === 0}
            onClick={submit}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`}
          >
            Add to product
          </button>
        </>
      }
    >
      <p>
        Choose images, videos or 3D models from your computer. They show up in this
        product straight away while they are sent to the store in the background.
      </p>

      <FilePicker
        files={files}
        onChange={setFiles}
        max={LIMITS.newMedia}
        idPrefix="add-media"
      />
    </Dialog>
  )
}
