import { useCallback, useRef, useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type ProductMediaInput } from '../../../lib/api/endpoints.ts'
import { sendFileToTarget } from '../../../lib/api/upload.ts'
import { mimeOf, type PickedFile } from '../utils/mediaFiles.ts'

export interface FileUploadState {
  status: 'uploading' | 'done' | 'failed'
  /** Where the store keeps it once uploaded: what `POST /media` attaches. */
  resourceUrl?: string
  error?: string
}

/**
 * Uploads files chosen from the computer to a product, one after the other: for each, the
 * backend gives an upload address (`POST /products/{id}/media/upload-target`), the file is
 * sent there, and the returned `resource_url` is what is attached afterwards (as `url` of
 * `POST /products/{id}/media` — the caller does that, with `items` this returns).
 *
 * A file that is already uploaded is not sent again, so trying again after a failure only
 * redoes the files that failed. `states` tells each file's progress, by its key.
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
      for (const picked of files) {
        if (done.current[picked.key]) continue
        set(picked.key, { status: 'uploading' })
        try {
          const target = await api.products.uploadTarget(
            productId,
            {
              filename: picked.file.name,
              mime_type: mimeOf(picked.file),
              file_size: picked.file.size,
              media_type: picked.type,
            },
            shop,
          )
          await sendFileToTarget(target, picked.file)
          done.current[picked.key] = target.resourceUrl
          set(picked.key, { status: 'done', resourceUrl: target.resourceUrl })
        } catch (error) {
          failed += 1
          set(picked.key, { status: 'failed', error: toUserMessage(error) })
        }
      }
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
