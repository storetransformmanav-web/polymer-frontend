import type { ComponentType, ReactNode } from 'react'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import type { IconProps } from '../../../components/ui/icons.tsx'

/**
 * A details card made for a table: a header row (an icon, the title, an optional count and, at the right,
 * the card's own controls such as a search box) over a body that takes **all the height the tab has left**
 * from `lg` up — so the table inside scrolls in its own box with its pagination fixed beneath it, as in
 * the lists, instead of the page growing. Below `lg` the card is as tall as its content.
 */
export function FillCard({
  title,
  icon: Icon,
  count,
  actions,
  children,
}: {
  title: string
  icon: ComponentType<IconProps>
  /** A small pill after the title (how many rows there are). */
  count?: number
  /** Controls at the right of the header. */
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className={`${DETAIL_CARD} flex min-w-0 flex-col overflow-hidden lg:min-h-0 lg:flex-1`}
    >
      <header className="border-border-strong flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b px-4 py-2.5">
        <Icon width={18} height={18} className="text-accent shrink-0" />
        <h3 className="text-[0.95rem] font-semibold">{title}</h3>
        {count !== undefined && (
          <span className="bg-accent-tint text-accent border-border rounded-full border px-2 py-0.5 text-[0.68rem] font-bold">
            {count.toLocaleString('en-GB')}
          </span>
        )}
        {actions && <div className="ml-auto">{actions}</div>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}
