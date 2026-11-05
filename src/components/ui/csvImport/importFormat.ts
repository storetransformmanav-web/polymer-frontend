/** The dialogs' footer buttons: a plain one (Cancel, Close) and the main one. */
const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
export const BUTTON_PLAIN = `${BUTTON} border-border bg-bg text-text hover:border-accent`
export const BUTTON_PRIMARY = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`

/** A figure the backend gave, in words: "to_create" → "To create". */
export function countLabel(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const formatNumber = (value: number) => value.toLocaleString('en-GB')

/** "1.4 MB", "820 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
