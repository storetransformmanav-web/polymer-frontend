import type { ReactNode } from 'react'
import { ImageIcon } from '../../../components/ui/icons.tsx'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import { safeUrl } from '../../../lib/safeUrl.ts'

/** A page card: a bold heading (with an optional line under it and controls at the right), then its content. */
export function LockCard({
  title,
  description,
  actions,
  error,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  /** A problem with what is in this card (shown under the heading, announced). */
  error?: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={`${DETAIL_CARD} flex flex-col`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="text-[0.95rem] font-semibold">{title}</h3>
          {description && (
            <p className="text-text-muted mt-0.5 text-[0.8rem] leading-snug">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {error && (
        <p role="alert" className="text-danger px-5 pb-2 text-[0.82rem]">
          {error}
        </p>
      )}
      <div className="border-border-strong border-t p-5">{children}</div>
    </section>
  )
}

const SIZES = { sm: 'h-8 w-8', lg: 'h-14 w-14' } as const

/** A product's picture (https/http only, no referrer) or a plain tile when it has none. */
export function LockImage({
  src,
  size = 'sm',
}: {
  src: string | null | undefined
  size?: keyof typeof SIZES
}) {
  const safe = safeUrl(src)
  const box = `border-border bg-surface shrink-0 overflow-hidden rounded-lg border ${SIZES[size]}`
  return safe ? (
    <img
      src={safe}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${box} object-cover`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${box} text-text-muted inline-flex items-center justify-center`}
    >
      <ImageIcon width={size === 'lg' ? 22 : 16} height={size === 'lg' ? 22 : 16} />
    </span>
  )
}
