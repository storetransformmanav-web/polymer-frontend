import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { LayersIcon, PlusIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { useAccess } from '../../../hooks/useAccess.ts'
import type { CollectionDetail, CollectionListItem } from '../../../lib/api/endpoints.ts'
import { CollectionCreateView } from '../components/CollectionCreateView.tsx'
import { CollectionDetailsView } from '../components/CollectionDetailsView.tsx'
import { PRIMARY_BUTTON } from '../utils/ui.ts'
import { CollectionsList } from '../components/CollectionsList.tsx'
import { CollectionsToolbar } from '../components/CollectionsToolbar.tsx'
import { useCollections, useCollectionShop } from '../hooks/useCollections.ts'

const LIST_PATH = '/collections'
const NEW_PATH = '/collections/new'
const DRAFT_TAB = '__new__'
const MAX_TABS = 10
const NOTICE_MS = 10_000
const detailsPath = (id: string) => `${LIST_PATH}/${encodeURIComponent(id)}`

// From `lg` the page fills the window (`fillHeight` in navigation.ts): the table scrolls in its
// own box, and a collection's page and the Add collection form scroll inside this one.
const SCROLL_VIEW = 'relative lg:min-h-0 lg:flex-1 lg:overflow-y-auto'

interface Tab {
  id: string
  title: string | null
}

/**
 * Collections: the list at `/collections`, **Add collection** at `/collections/new` and one
 * collection's page at `/collections/:id` (CRM id or handle) — all in this same page, like
 * Products. The list stays mounted (hidden) so coming back keeps its search, filters and page;
 * each opened collection gets a tab in the strip above. Everything follows the store picked in
 * the top bar; a new collection is made in that store (or the first connected one).
 */
export function CollectionsPage() {
  const { listShop, createShop, createShopName } = useCollectionShop()
  const collections = useCollections(listShop)
  const { canManage } = useAccess('products')
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const first = splat ? decodeURIComponent(splat.split('/')[0]) : ''
  const creating = first === 'new'
  const activeId = first && !creating ? first : null

  const [tabs, setTabs] = useState<Tab[]>([])
  const [formOpen, setFormOpen] = useState(creating)
  const [dirty, setDirty] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  // A collection opened from a bare address gets a tab too (named once it loads).
  const openTab = useCallback((id: string, title: string | null) => {
    setTabs((current) => {
      const at = current.findIndex((tab) => tab.id === id)
      if (at >= 0) {
        if (!title || current[at].title === title) return current
        return current.map((tab, index) => (index === at ? { ...tab, title } : tab))
      }
      return [...current, { id, title }].slice(-MAX_TABS)
    })
  }, [])
  // (React's "adjust state while rendering": a new address opens its tab in the same render.)
  if (activeId && !tabs.some((tab) => tab.id === activeId)) {
    setTabs((current) =>
      current.some((tab) => tab.id === activeId)
        ? current
        : [...current, { id: activeId, title: null }].slice(-MAX_TABS),
    )
  }

  const formShown = formOpen || creating

  function openCollection(collection: CollectionListItem) {
    setNotice(null)
    openTab(collection.id, collection.title)
    navigate(detailsPath(collection.id))
  }

  function closeTab(id: string) {
    const index = tabs.findIndex((tab) => tab.id === id)
    const neighbour = tabs[index + 1] ?? tabs[index - 1]
    setTabs((current) => current.filter((tab) => tab.id !== id))
    if (id === activeId) navigate(neighbour ? detailsPath(neighbour.id) : LIST_PATH)
  }

  const closeForm = useCallback(() => {
    setConfirmingClose(false)
    setFormOpen(false)
    setDirty(false)
    navigate(LIST_PATH)
  }, [navigate])

  /** Back / Cancel / the tab's ✕: ask first when something was typed. */
  const requestClose = useCallback(() => {
    if (dirty) setConfirmingClose(true)
    else closeForm()
  }, [dirty, closeForm])

  function handleCreated(message: string, collection: CollectionDetail) {
    setFormOpen(false)
    setDirty(false)
    setNotice(message)
    openTab(collection.id, collection.title)
    navigate(detailsPath(collection.id))
  }

  const addButton = canManage ? (
    <button
      type="button"
      onClick={() => {
        setNotice(null)
        setFormOpen(true)
        navigate(NEW_PATH)
      }}
      className={PRIMARY_BUTTON}
    >
      <PlusIcon width={16} height={16} />
      Add collection
    </button>
  ) : null

  const data = collections.data

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <OpenTabsBar
        tabs={[
          ...tabs.map((tab) => ({
            id: tab.id,
            label: tab.title ?? 'Collection',
            title: tab.title ?? undefined,
          })),
          ...(formShown ? [{ id: DRAFT_TAB, label: 'New collection' }] : []),
        ]}
        activeId={creating ? DRAFT_TAB : activeId}
        navLabel="Open collections"
        listLabel="All Collections"
        kind="Collection"
        historyLabel="Opened collections"
        icon={LayersIcon}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => navigate(id === DRAFT_TAB ? NEW_PATH : detailsPath(id))}
        onClose={(id) => (id === DRAFT_TAB ? requestClose() : closeTab(id))}
        onClear={() => {
          setTabs([])
          if (activeId) navigate(LIST_PATH)
          if (formShown) requestClose()
        }}
      />

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      {activeId && (
        <div className={`${SCROLL_VIEW} flex flex-col`}>
          <CollectionDetailsView
            key={activeId}
            id={activeId}
            shop={listShop}
            onBack={() => navigate(LIST_PATH)}
            onLoaded={(collection) => openTab(activeId, collection.title)}
          />
        </div>
      )}

      {/* The form stays mounted (hidden) with what was typed while the list or a collection shows. */}
      {formShown && canManage && (
        <div className={creating ? SCROLL_VIEW : 'hidden'}>
          <CollectionCreateView
            shop={createShop}
            shopName={createShopName}
            onBack={requestClose}
            onCreated={handleCreated}
            onDirtyChange={setDirty}
          />
        </div>
      )}

      <div
        className={
          activeId || creating ? 'hidden' : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'
        }
      >
        <CollectionsToolbar
          filters={collections.filters}
          hasFilters={collections.hasFilters}
          onChange={collections.setFilters}
          onReset={collections.resetFilters}
          actions={addButton}
        />

        <section
          aria-label="Collections"
          className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
        >
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
              collections.isFetching && !collections.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <HighlightQuery query={collections.filters.search}>
            <CollectionsList
              items={collections.items}
              isPending={collections.isPending}
              error={collections.error}
              hasFilters={collections.hasFilters}
              isStale={collections.isShowingPrevious}
              showStore={listShop === ''}
              onOpen={openCollection}
              onRetry={collections.retry}
              onClearFilters={collections.resetFilters}
              emptyAction={addButton}
            />
          </HighlightQuery>

          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={collections.filters.pageSize}
              total={data.total}
              totalPages={data.total_pages}
              onPageChange={(page) => collections.setFilters({ page })}
              onPageSizeChange={(pageSize) => collections.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>

      {confirmingClose && (
        <ConfirmCancelDialog
          lose="what you entered for the new collection"
          onConfirm={closeForm}
          onKeep={() => setConfirmingClose(false)}
        />
      )}
    </div>
  )
}
