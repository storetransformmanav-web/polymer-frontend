/** Saves a file through the browser's download (no server round trip). */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked a moment later: some browsers start the download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
