import type { ReactNode } from 'react'

/**
 * One bordered card of an edit page (the Edit Variant and Edit Variants pages): a small uppercase
 * accent title — with an optional count and a quiet line at its right — over its fields. `flush`
 * drops the body's padding for a list that runs edge to edge; `problem` gives the card a red border.
 */
export function PageCard({
  title,
  count,
  aside,
  problem = false,
  flush = false,
  children,
}: {
  title: string
  count?: number
  aside?: ReactNode
  problem?: boolean
  flush?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className={`bg-bg flex flex-col rounded-xl border ${
        problem ? 'border-danger' : 'border-border-strong'
      }`}
    >
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 sm:px-5 sm:pt-5 ${
          flush ? 'border-border-strong border-b pb-3' : 'pb-3'
        }`}
      >
        <h3 className="text-accent m-0 flex items-center gap-2 text-[0.75rem] font-bold tracking-wide uppercase">
          {title}
          {count !== undefined && (
            <span className="bg-accent-tint text-text-muted rounded-full px-2 py-0.5 text-[0.68rem] tracking-normal">
              {count}
            </span>
          )}
        </h3>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      <div className={flush ? '' : 'flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5'}>
        {children}
      </div>
    </section>
  )
}
