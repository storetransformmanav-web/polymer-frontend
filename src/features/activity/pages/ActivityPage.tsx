import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { ActivityIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { ActivityItem } from '../../../lib/api/endpoints.ts'
import { ActivityDetailsView } from '../components/ActivityDetailsView.tsx'
import { ActivityList } from '../components/ActivityList.tsx'
import { ActivityToolbar } from '../components/ActivityToolbar.tsx'
import { useActivity } from '../hooks/useActivity.ts'
import { useActivityFilterOptions } from '../hooks/useActivityFilterOptions.ts'
import { readableSummary } from '../utils/format.ts'

const LIST_PATH = '/activity'
const MAX_TABS = 10

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Activity Management: the CRM's audit log — who did what, when and from
 * where — with search, user/role/date filters and paging.
 * Data comes from TanStack Query (see useActivity): pages and filters are
 * cached so revisiting one is instant, the previous rows stay on screen while
 * the next load, and the next page is fetched ahead of time.
 *
 * **Opening an entry** (its View button or the card) shows its details **in this same page**, at
 * `/activity/:id`, laid out like a product's page — never in a slide-over. Each opened entry is a tab in
 * a strip above (up to 10; "All Activity" returns to the list, which stays mounted but hidden so it keeps
 * its search, filters and page). The API has no call for one entry on its own, so a page is drawn from the
 * row the list read: reached by an address alone (a reload), it says the entry is not loaded.
 */
export function ActivityPage() {
  const activity = useActivity()
  // The dropdown choices are loaded when the Filters grid is opened, not when the page opens.
  const [wantOptions, setWantOptions] = useState(false)
  const options = useActivityFilterOptions(wantOptions)
  const { filters, data } = activity
  const navigate = useNavigate()
  const { '*': splat } = useParams()

  // The entries opened so far (each is a tab), kept as the list read them.
  const [opened, setOpened] = useState<ActivityItem[]>([])
  const activeRef = splat ? decode(splat.split('/')[0]) : null
  const activeItem = activeRef
    ? (opened.find((entry) => String(entry.id) === activeRef) ??
      activity.items.find((entry) => String(entry.id) === activeRef) ??
      null)
    : null

  // An address that names an entry the list has loaded gets its tab too (React's "adjust state
  // while rendering": it opens in the same render).
  if (activeItem && !opened.some((entry) => entry.id === activeItem.id)) {
    setOpened((current) =>
      current.some((entry) => entry.id === activeItem.id)
        ? current
        : [...current, activeItem].slice(-MAX_TABS),
    )
  }

  function open(item: ActivityItem) {
    setOpened((current) =>
      current.some((entry) => entry.id === item.id)
        ? current
        : [...current, item].slice(-MAX_TABS),
    )
    navigate(`${LIST_PATH}/${item.id}`)
  }

  function closeTab(id: string) {
    const index = opened.findIndex((entry) => String(entry.id) === id)
    const neighbour = opened[index + 1] ?? opened[index - 1]
    setOpened((current) => current.filter((entry) => String(entry.id) !== id))
    if (id === activeRef) {
      navigate(neighbour ? `${LIST_PATH}/${neighbour.id}` : LIST_PATH)
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh refreshing={activity.isFetching} onRefresh={activity.retry} />

      <OpenTabsBar
        tabs={opened.map((entry) => ({
          id: String(entry.id),
          label: `#${entry.id}`,
          title: readableSummary(entry.summary, entry.action),
        }))}
        activeId={activeItem ? String(activeItem.id) : null}
        navLabel="Open activity entries"
        listLabel="All Activity"
        kind="Activity"
        historyLabel="Opened activity entries"
        icon={ActivityIcon}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => navigate(`${LIST_PATH}/${id}`)}
        onClose={closeTab}
        onClear={() => {
          setOpened([])
          if (activeRef) navigate(LIST_PATH)
        }}
      />

      {activeRef && (
        <ActivityDetailsView
          key={activeRef}
          item={activeItem}
          reference={activeRef}
          onBack={() => navigate(LIST_PATH)}
        />
      )}

      {/* Kept mounted but hidden while an entry is open, so Back finds the search, filters and page. */}
      <div className={activeRef ? 'hidden' : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'}>
        <ActivityToolbar
          filters={filters}
          users={options.users}
          roles={options.roles}
          hasFilters={activity.hasFilters}
          rangeInvalid={activity.rangeInvalid}
          onChange={activity.setFilters}
          onReset={activity.resetFilters}
          onWantOptions={() => setWantOptions(true)}
        />

        <section
          aria-label="Activity"
          className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
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

          <HighlightQuery query={filters.search}>
            <ActivityList
              items={activity.items}
              isPending={activity.isPending}
              error={activity.error}
              hasFilters={activity.hasFilters}
              isStale={activity.isShowingPrevious}
              onOpen={open}
              onRetry={activity.retry}
              onClearFilters={activity.resetFilters}
            />
          </HighlightQuery>

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
      </div>
    </div>
  )
}
