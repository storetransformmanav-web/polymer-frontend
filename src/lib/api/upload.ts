import { ApiError } from './ApiError.ts'
import type { UploadTarget } from './endpoints.ts'

/**
 * Sends a file to the address the backend gave for it (`POST /products/{id}/media/upload-target`).
 *
 * That address belongs to the store's file storage, not to our backend, so this deliberately
 * does **not** go through `apiClient`: no session token may be sent there. The request has no
 * credentials, cookies or referrer. With form `parameters` the file goes as a multipart form
 * (the parameters first, the file last, as the storage requires); without them it is sent as
 * the request body with the file's own type. Never retried — a failed upload is simply tried
 * again by the user.
 */
export async function sendFileToTarget(target: UploadTarget, file: File): Promise<void> {
  let response: Response
  try {
    if (target.parameters.length > 0 || target.method === 'POST') {
      const form = new FormData()
      for (const { name, value } of target.parameters) form.append(name, value)
      form.append('file', file)
      response = await fetch(target.uploadUrl, {
        method: 'POST',
        body: form,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
    } else {
      response = await fetch(target.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: file.type ? { 'Content-Type': file.type } : undefined,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
    }
  } catch {
    throw new ApiError(
      'The file could not be sent. Check your connection and try again.',
      { code: 'ERR_NETWORK' },
    )
  }
  if (!response.ok) {
    throw new ApiError(
      `The store refused the file (error ${response.status}). Try again, or use a smaller file.`,
      { status: response.status },
    )
  }
}
