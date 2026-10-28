import { useCallback, useRef, useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type ProductMediaInput } from '../../../lib/api/endpoints.ts'
import { sendFileToTarget } from '../../../lib/api/upload.ts'
import { forUpload, mimeOf, type PickedFile } from '../utils/mediaFiles.ts'

export interface FileUploadState {
  status: 'uploading' | 'done' | 'failed'
  /** Where the store keeps it once uploaded: what `POST /media` attaches. */
  resourceUrl?: string
  error?: string
}

/**
 * How many files go up at the same time. Each file costs two round trips (the upload address,
 * then the storage's answer) before and after its bytes, so doing them one by one made a
 * handful of pictures take as long as all of those waits added together. A few at once keeps
 * that waiting overlapped without opening a connection per file for a big batch.
 */
export const UPLOAD_CONCURRENCY = 3

/**
 * Uploads files chosen from the computer to a product, a few at a time: for each, the
 * backend gives an upload address (`POST /products/{id}/media/upload-target`), the file is
 * sent there, and the returned `resource_url` is what is attached afterwards (as `url` of
 * `POST /products/{id}/media` — the caller does that, with `items` this returns, in the
 * order the files were chosen whichever finished first, so the first one stays the featured
 * image).
 *
 * A file that is already uploaded is not sent again, so trying again after a failure only
 * redoes the files that failed. A file that fails does not stop the others. `states` tells
 * each file's progress, by its key.
 */
export function useFileUpload() {
  const [states, setStates] = useState<Record<string, FileUploadState>>({})
  const done = useRef<Record<string, string>>({})

  const set = (key: string, state: FileUploadState) =>
    setStates((current) => ({ ...current, [key]: state }))

  const upload = useCallback(
    async (
      productId: string,
      shop: string | null | undefined,
      files: readonly PickedFile[],
    ): Promise<{ items: ProductMediaInput[]; failed: number }> => {
      let failed = 0
      const waiting = files.filter((picked) => !done.current[picked.key])
      let next = 0

      async function uploadOne(picked: PickedFile) {
        set(picked.key, { status: 'uploading' })
        try {
          const toSend = forUpload(picked.file)
          const target = await api.products.uploadTarget(
            productId,
            {
              filename: toSend.name,
              mime_type: mimeOf(toSend),
              size_bytes: toSend.size,
              media_type: picked.type,
            },
            shop,
          )
          await sendFileToTarget(target, toSend)
          done.current[picked.key] = target.resourceUrl
          set(picked.key, { status: 'done', resourceUrl: target.resourceUrl })
        } catch (error) {
          failed += 1
          set(picked.key, { status: 'failed', error: toUserMessage(error) })
        }
      }

      // A few workers each take the next waiting file, in the order chosen, until none is left.
      async function worker() {
        while (next < waiting.length) {
          const picked = waiting[next]
          next += 1
          await uploadOne(picked)
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, waiting.length) }, worker),
      )
      const items: ProductMediaInput[] = files
        .filter((picked) => done.current[picked.key])
        .map((picked) => ({ url: done.current[picked.key], media_type: picked.type }))
      return { items, failed }
    },
    [],
  )

  const reset = useCallback(() => {
    done.current = {}
    setStates({})
  }, [])

  return { upload, states, reset }
}
