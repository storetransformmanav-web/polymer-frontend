import type { ComponentType, ReactNode } from 'react'
import { DetailsHeader } from '../../../components/ui/DetailsHeader.tsx'
import type { IconProps } from '../../../components/ui/icons.tsx'

export interface DetailPageTab {
  id: string
  label: string
  icon: ComponentType<IconProps>
  count?: number
}

interface DetailPageProps {
  /** Ids of the tab elements are made from this ("sage-customer" → `sage-customer-tab-overview`). */
  idPrefix: string
  visual: ReactNode
  title: ReactNode
  titleHint?: string
  status?: ReactNode
  chips?: ReactNode
  actions?: ReactNode
  onBack: () => void
  backLabel?: string
  tabs: DetailPageTab[]
  tab: string
  onTab: (id: string) => void
  children: ReactNode
}

/**
 * The frame of a details page in this feature, laid out like a product's (and a lock's) page: a
 * bordered article, the shared header (a tile, the name, a status pill, the facts as chips, the
 * page's own buttons and a rounded **Back to list**), a tab strip and the tab's content in its own
 * scrolling box. A Sage customer's page uses it.
 */
export function DetailPage({
  idPrefix,
  visual,
  title,
  titleHint,
  status,
  chips,
  actions,
  onBack,
  backLabel,
  tabs,
  tab,
  onTab,
  children,
}: DetailPageProps) {
  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <DetailsHeader
        className="border-border mx-4 mt-4 shrink-0 border-b pb-3 sm:mx-5"
        visual={visual}
        title={title}
        titleHint={titleHint}
        status={status}
        chips={chips}
        actions={actions}
        onBack={onBack}
        backLabel={backLabel}
      />

      <div
        role="tablist"
        aria-label="Sections"
        className="border-border mx-4 flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto border-b sm:mx-5 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`${idPrefix}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${idPrefix}-tabpanel`}
              onClick={() => onTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-3 text-[0.88rem] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? 'border-accent text-accent'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              <item.icon width={17} height={17} />
              {item.label}
              {item.count !== undefined && (
                <span className="bg-surface text-text-muted border-border rounded-full border px-1.5 py-0.5 text-[0.68rem] font-bold">
                  {item.count.toLocaleString('en-GB')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id={`${idPrefix}-tabpanel`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${tab}`}
        className="flex flex-col gap-4 p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {children}
      </div>
    </article>
  )
}
