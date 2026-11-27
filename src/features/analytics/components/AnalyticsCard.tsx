import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '../../../components/ui/icons.tsx'

/** The page's card: soft border, rounded corners and a faint lift. */
export const CARD = 'border-border bg-bg rounded-[14px] border shadow-xs'

/** A card's title row: an optional icon tile, the title and a line under it, actions at the right. */
export function CardTitle({
  icon: Icon,
  title,
  note,
  children,
}: {
  icon?: ComponentType<IconProps>
  title: string
  note?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="bg-accent-tint text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Icon width={18} height={18} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-text m-0 text-[1rem] leading-tight font-bold">{title}</h2>
          {note && (
            <p className="text-text-muted mt-1 mb-0 text-[0.76rem] leading-snug">
              {note}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}
