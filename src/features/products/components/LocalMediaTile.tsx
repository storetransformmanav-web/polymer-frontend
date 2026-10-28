import { BoxesIcon, ImageIcon, TrashIcon } from '../../../components/ui/icons.tsx'
import { DETAIL_CARD as CARD } from '../../../components/ui/DetailSection.tsx'
import type { LocalMediaItem } from '../../../app/store/productsSlice.ts'

/** What a waiting file says about itself under its picture. */
function caption(item: LocalMediaItem, slow: boolean): string {
  if (item.status === 'uploading') return 'Uploading'
  if (item.status === 'sent')
    return slow ? 'Still syncing with the store' : 'Syncing with the store'
  return 'Not uploaded'
}

const ACTION =
  'border-border bg-bg text-text hover:border-accent hover:text-accent inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2 text-[0.75rem] font-semibold transition-colors'

/**
 * The file itself, drawn from its own in-memory preview (never a web address), so it is on
 * screen the moment it is chosen and needs nothing from the store.
 */
export function LocalPreview({
  item,
  className = 'aspect-square w-full rounded-xl object-contain',
}: {
  item: LocalMediaItem
  className?: string
}) {
  if (item.mediaType === 'IMAGE' && item.previewUrl.startsWith('blob:')) {
    return (
      <img
        src={item.previewUrl}
        alt={item.name}
        decoding="async"
        className={`border-border bg-surface border ${className}`}
      />
    )
  }
  if (item.mediaType === 'VIDEO' && item.previewUrl.startsWith('blob:')) {
    return (
      <video
        src={item.previewUrl}
        aria-label={item.name}
        muted
        playsInline
        preload="metadata"
        className={`border-border bg-surface border ${className}`}
      />
    )
  }
  return (
    <span
      role="img"
      aria-label={item.name}
      className="border-border bg-accent-tint text-accent flex aspect-square w-full items-center justify-center rounded-xl border"
    >
      {item.mediaType === 'MODEL_3D' ? (
        <BoxesIcon width={44} height={44} />
      ) : (
        <ImageIcon width={44} height={44} />
      )}
    </span>
  )
}

/**
 * A file the user just added, as a tile of the Media tab: its own picture at once, a quiet
 * line saying where it is (uploading / syncing with the store), and — only when it really
 * failed — the reason with **Try again** and **Remove**.
 */
export function LocalMediaTile({
  item,
  slow,
  onRetry,
  onRemove,
}: {
  item: LocalMediaItem
  slow: boolean
  onRetry: () => void
  onRemove: () => void
}) {
  const failed = item.status === 'failed'
  return (
    <li
      aria-label={`${item.name}: ${caption(item, slow)}`}
      className={`${CARD} relative overflow-hidden ${failed ? 'border-danger' : ''}`}
    >
      <LocalPreview item={item} />
      <p
        className="text-text truncate px-3 pt-2 text-[0.75rem] font-medium"
        title={item.name}
      >
        {item.name}
      </p>
      {failed ? (
        <div className="flex flex-col gap-2 px-3 pt-1 pb-3">
          <p role="alert" className="text-danger text-[0.75rem] break-words">
            {item.error ?? 'This file could not be uploaded.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={onRetry} className={ACTION}>
              Try again
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${item.name}`}
              className={ACTION}
            >
              <TrashIcon width={13} height={13} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <p className="text-text-muted truncate px-3 pb-2 text-[0.75rem]">
          {caption(item, slow)}
        </p>
      )}
    </li>
  )
}
