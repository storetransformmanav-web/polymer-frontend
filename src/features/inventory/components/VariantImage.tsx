import { useState } from 'react'
import { InventoryIcon } from '../../../components/ui/icons.tsx'
import { safeUrl } from '../../../lib/safeUrl.ts'

const SIZES = {
  sm: 'h-8 w-8 rounded-md',
  md: 'h-14 w-14 rounded-lg',
  lg: 'h-16 w-16 rounded-xl',
} as const

/**
 * A variant's picture that never leaves a broken-image icon behind: a missing, unsafe (not
 * http/https) or failing address shows a neutral glyph instead. Loads lazily and sends no referrer.
 */
export function VariantImage({
  src,
  size = 'sm',
}: {
  src: string | null | undefined
  size?: keyof typeof SIZES
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const safe = safeUrl(src)
  const box = SIZES[size]
  if (!safe || failed === safe) {
    return (
      <span
        aria-hidden="true"
        className={`border-border bg-accent-tint text-accent flex shrink-0 items-center justify-center border ${box}`}
      >
        <InventoryIcon width={size === 'sm' ? 16 : 24} height={size === 'sm' ? 16 : 24} />
      </span>
    )
  }
  return (
    <img
      src={safe}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(safe)}
      className={`border-border bg-surface shrink-0 border object-cover ${box}`}
    />
  )
}
