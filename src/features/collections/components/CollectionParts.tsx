import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { ImageIcon } from '../../../components/ui/icons.tsx'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { isSmart, typeLabel } from '../utils/collectionDraft.ts'

const SIZES = {
  sm: 'h-8 w-8',
  lg: 'h-14 w-14',
  // The details page's big picture: a square, the whole picture visible.
  xl: 'aspect-square w-full rounded-xl',
} as const
const ICON = { sm: 16, lg: 22, xl: 56 } as const

/** A collection's or product's picture (https/http only, no referrer), or a plain tile. */
export function CollectionImage({
  src,
  size = 'sm',
  alt = '',
}: {
  src: string | null | undefined
  size?: keyof typeof SIZES
  alt?: string
}) {
  const safe = safeUrl(src)
  const box = `border-border bg-surface shrink-0 overflow-hidden rounded-lg border ${SIZES[size]}`
  return safe ? (
    <img
      src={safe}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${box} ${size === 'xl' ? 'object-contain' : 'object-cover'}`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${box} text-text-muted inline-flex items-center justify-center`}
    >
      <ImageIcon width={ICON[size]} height={ICON[size]} />
    </span>
  )
}

/** Manual (picked by hand) or Automated (filled by its conditions). */
export function TypeBadge({
  type,
  className = '',
}: {
  type: string | null | undefined
  className?: string
}) {
  return (
    <Badge tone={isSmart(type) ? 'warning' : 'success'} className={className}>
      {typeLabel(type)}
    </Badge>
  )
}

/** An empty or error state in the middle of a card. */
export function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}
