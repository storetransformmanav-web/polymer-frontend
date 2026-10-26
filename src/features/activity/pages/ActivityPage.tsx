import { useCallback, useState } from 'react'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { ActivityItem } from '../../../lib/api/endpoints.ts'
import { ActivityDetailsPanel } from '../components/ActivityDetailsPanel.tsx'
import { ActivityList } from '../components/ActivityList.tsx'
import { ActivityToolbar } from '../components/ActivityToolbar.tsx'
import { useActivity } from '../hooks/useActivity.ts'
import { useActivityFilterOptions } from '../hooks/useActivityFilterOptions.ts'

/**
 * Activity Management: the CRM's audit log — who did what, when and from
 * where — with search, user/action/date filters and paging.
 * Data comes from TanStack Query (see useActivity): pages and filters are
 * cached so revisiting one is instant, the previous rows stay on screen while
 * the next load, and the next page is fetched ahead of time.
 */
export function ActivityPage() {
  const activity = useActivity()
  // The dropdown choices are loaded when the Filters grid is opened, not when the page opens.
  const [wantOptions, setWantOptions] = useState(false)
  const options = useActivityFilterOptions(wantOptions)
  const { filters, data } = activity
  // The row whose details panel is open.
  const [selected, setSelected] = useState<ActivityItem | null>(null)
  const closePanel = useCallback(() => setSelected(null), [])

  return (
    <div className="flex flex-col gap-4">
      <ActivityToolbar
        filters={filters}
        actions={options.actions}
        total={data?.total ?? null}
        hasFilters={activity.hasFilters}
        rangeInvalid={activity.rangeInvalid}
        onChange={activity.setFilters}
        onReset={activity.resetFilters}
        onWantOptions={() => setWantOptions(true)}
      />

      <section
        aria-label="Activity"
        className="border-border bg-bg relative overflow-hidden rounded-2xl border"
      >
        {/* Thin activity bar: results stay on screen while a refresh runs. */}
        <div
          aria-hidden="true"
          className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
            activity.isFetching && !activity.isPending
              ? 'animate-pulse opacity-100'
              : 'opacity-0'
          }`}
        />

        <ActivityList
          items={activity.items}
          isPending={activity.isPending}
          error={activity.error}
          hasFilters={activity.hasFilters}
          isStale={activity.isShowingPrevious}
          onOpen={setSelected}
          onRetry={activity.retry}
          onClearFilters={activity.resetFilters}
        />

        {data && data.total > 0 && (
          <PaginationFooter
            page={data.page}
            pageSize={filters.pageSize}
            total={data.total}
            totalPages={data.total_pages}
            onPageChange={(page) => activity.setFilters({ page })}
            onPageSizeChange={(pageSize) => activity.setFilters({ pageSize })}
          />
        )}
      </section>

      {selected && <ActivityDetailsPanel item={selected} onClose={closePanel} />}
    </div>
  )
}
