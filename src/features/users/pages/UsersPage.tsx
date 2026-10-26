import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PlusIcon, UsersIcon } from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { useShops } from '../../../hooks/useShops.ts'
import type { UserCreateBody, UserItem } from '../../../lib/api/endpoints.ts'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'
import { UserCreateView } from '../components/UserCreateView.tsx'
import { UserDetailsView } from '../components/UserDetailsView.tsx'
import { UserDeleteDialog, type UserToDelete } from '../components/UserDeleteDialog.tsx'
import { UsersKpis } from '../components/UsersKpis.tsx'
import { UsersList } from '../components/UsersList.tsx'
import { UsersToolbar } from '../components/UsersToolbar.tsx'
import { useCreateUser } from '../hooks/useCreateUser.ts'
import { useRoles } from '../hooks/useRoles.ts'
import { usePrefetchUserDetails, useUserDetails } from '../hooks/useUserDetails.ts'
import { useUserTabs } from '../hooks/useUserTabs.ts'
import { useUsers } from '../hooks/useUsers.ts'
import { userName } from '../utils/format.ts'

/** How long the "user added" confirmation stays on screen. */
const NOTICE_MS = 8000

const LIST_PATH = '/users'
const NEW_PATH = '/users/new'
// The tab of the form being filled in (not a user id).
const NEW_TAB = '__new-user__'
const detailsPath = (id: string) => `${LIST_PATH}/${encodeURIComponent(id)}`

/**
 * Users: the CRM's staff accounts, with search, filters (status, role), paging, one user's
 * details at `/users/:id` (View button — in place of the list, like a product's, with a tab
 * per opened user) and an "Add user" form that opens in place of the list at `/users/new` —
 * like "Add product", as a tab of its own that keeps what was typed while you look at the list. Data comes from
 * TanStack Query (see useUsers), so revisiting a page or filter is instant and a new user
 * appears as soon as the list refetches.
 */
export function UsersPage() {
  const users = useUsers()
  const roles = useRoles()
  const { shops } = useShops()
  const createUser = useCreateUser()
  const userTabs = useUserTabs()
  const prefetchDetails = usePrefetchUserDetails()
  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const { filters, data } = users
  const { clearError } = createUser
  const { openTab } = userTabs

  // `/users/<id>` → the user whose details show; `/users` and `/users/new` → none.
  const first = splat ? splat.split('/')[0] : ''
  const activeId = first && first !== 'new' ? first : null
  const activeRow = activeId
    ? (users.items.find((item) => item.id === activeId) ?? null)
    : null
  const details = useUserDetails(activeId, activeRow)
  const known = details.user ?? activeRow
  const knownName = known ? userName(known) : null
  const knownEmail = known?.email ?? null

  // Every opened user gets a tab — also one reached by a bare URL, labelled once it loads.
  useEffect(() => {
    if (activeId) openTab({ id: activeId, name: knownName, email: knownEmail })
  }, [activeId, knownName, knownEmail, openTab])

  // The form is open — it stays mounted, with what was typed, while the list is shown. It starts
  // open when the page is reached at /users/new directly (a reload, a link).
  const [adding, setAdding] = useState(splat === 'new')
  const [dirty, setDirty] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // The user a trash button asked to delete (the dialog confirms).
  const [deleting, setDeleting] = useState<UserToDelete | null>(null)
  const closeDelete = useCallback(() => setDeleting(null), [])

  // The form is on screen (at /users/new); anywhere else it is only kept.
  const creatingRoute = splat === 'new'
  // Also drawn while the address is /users/new, e.g. after the browser's Back button.
  const formOpen = adding || creatingRoute

  const shopNames = useMemo(
    () => Object.fromEntries(shops.map((shop) => [shopValue(shop), shopLabel(shop)])),
    [shops],
  )

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const openForm = useCallback(() => {
    clearError()
    setNotice(null)
    setAdding(true)
    navigate(NEW_PATH)
  }, [clearError, navigate])

  /** Close the form for good and go back to the list. */
  const closeForm = useCallback(() => {
    clearError()
    setConfirmingClose(false)
    setAdding(false)
    setDirty(false)
    navigate(LIST_PATH)
  }, [clearError, navigate])

  /** Back / Cancel / the tab's ✕: ask first when something was entered. */
  const requestClose = useCallback(() => {
    if (dirty) setConfirmingClose(true)
    else closeForm()
  }, [dirty, closeForm])

  async function handleCreate(body: UserCreateBody) {
    const user = await createUser.create(body)
    closeForm()
    setNotice(`${userName(user)} (${user.email}) was added. They can now sign in.`)
    // Back to the first page: that's where the list is refetched.
    users.setFilters({ page: 1 })
  }

  function openUser(user: UserItem) {
    userTabs.openTab({ id: user.id, name: userName(user), email: user.email })
    navigate(detailsPath(user.id))
  }

  function closeUserTab(id: string) {
    const index = userTabs.tabs.findIndex((tab) => tab.id === id)
    const neighbour = userTabs.tabs[index + 1] ?? userTabs.tabs[index - 1]
    userTabs.closeTab(id)
    if (id === activeId) navigate(neighbour ? detailsPath(neighbour.id) : LIST_PATH)
  }

  /** Clear: closes every opened user, and the New user form (asking first if it has text). */
  function clearTabs() {
    userTabs.clearTabs()
    if (activeId) navigate(LIST_PATH)
    if (formOpen) requestClose()
  }

  function handleDeleted(user: UserToDelete, message: string) {
    setDeleting(null)
    userTabs.closeTab(user.id)
    setNotice(
      `Deleted “${user.name}”. ${message || 'The account is deactivated; its activity history is kept.'}`,
    )
    // That was the last row of a later page: step back to the one before.
    if (users.items.length === 1 && filters.page > 1) {
      users.setFilters({ page: filters.page - 1 })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The figures belong to the list, so the form takes their place (kept mounted, only hidden). */}
      <div className={creatingRoute || activeId ? 'hidden' : undefined}>
        <UsersKpis
          total={data?.total ?? null}
          roles={roles.roles}
          rolesLoaded={!roles.isPending && !roles.error}
        />
      </div>

      <OpenTabsBar
        tabs={[
          ...userTabs.tabs.map((tab) => ({
            id: tab.id,
            label: tab.name ?? `${tab.id.slice(0, 8)}…`,
            title: tab.email ?? undefined,
          })),
          ...(formOpen
            ? [{ id: NEW_TAB, label: 'New user', title: 'A user being added' }]
            : []),
        ]}
        activeId={creatingRoute ? NEW_TAB : activeId}
        navLabel="Open users"
        listLabel="All Users"
        kind="User"
        historyLabel="Opened users"
        icon={UsersIcon}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => navigate(id === NEW_TAB ? NEW_PATH : detailsPath(id))}
        onClose={(id) => (id === NEW_TAB ? requestClose() : closeUserTab(id))}
        onClear={clearTabs}
      />

      {activeId && (
        <UserDetailsView
          key={activeId}
          details={details}
          shopNames={shopNames}
          onBack={() => navigate(LIST_PATH)}
        />
      )}

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      {formOpen && (
        <div className={creatingRoute ? undefined : 'hidden'}>
          <UserCreateView
            roles={roles.roles}
            rolesError={roles.error}
            onRetryRoles={roles.retry}
            shops={shops}
            onCreate={handleCreate}
            isCreating={createUser.isCreating}
            error={createUser.error}
            onClearError={clearError}
            onBack={requestClose}
            onDirtyChange={setDirty}
          />
        </div>
      )}

      {/* Kept mounted but hidden while the form is open (display: none also removes it
          from tab order and screen readers). */}
      <div className={creatingRoute || activeId ? 'hidden' : 'flex flex-col gap-4'}>
        <UsersToolbar
          filters={filters}
          roles={roles.roles}
          total={data?.total ?? null}
          hasFilters={users.hasFilters}
          onChange={users.setFilters}
          onReset={users.resetFilters}
          // Add user sits in the search row, to the right of Filters and Clear All.
          actions={
            <button
              type="button"
              onClick={openForm}
              className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border-none px-4 text-[0.85rem] font-semibold shadow-sm transition-colors"
            >
              <PlusIcon width={16} height={16} />
              Add user
            </button>
          }
        />

        <section
          aria-label="Users"
          className="border-border bg-bg relative overflow-hidden rounded-2xl border"
        >
          {/* Thin activity bar: results stay on screen while a refresh runs. */}
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
              users.isFetching && !users.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <HighlightQuery query={filters.search}>
            <UsersList
              items={users.items}
              isPending={users.isPending}
              error={users.error}
              hasFilters={users.hasFilters}
              isStale={users.isShowingPrevious}
              shopNames={shopNames}
              onOpen={openUser}
              onPrefetch={prefetchDetails}
              onDelete={(user) => {
                setNotice(null)
                setDeleting({ id: user.id, name: userName(user), email: user.email })
              }}
              onRetry={users.retry}
              onClearFilters={users.resetFilters}
            />
          </HighlightQuery>

          {data && data.total > 0 && (
            <PaginationFooter
              page={data.page}
              pageSize={filters.pageSize}
              total={data.total}
              totalPages={data.total_pages}
              onPageChange={(page) => users.setFilters({ page })}
              onPageSizeChange={(pageSize) => users.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>

      {deleting && (
        <UserDeleteDialog
          key={`delete-${deleting.id}`}
          user={deleting}
          onClose={closeDelete}
          onDone={(message) => handleDeleted(deleting, message)}
        />
      )}

      {confirmingClose && (
        <ConfirmCancelDialog
          lose="what you entered for the new user"
          onConfirm={closeForm}
          onKeep={() => setConfirmingClose(false)}
        />
      )}
    </div>
  )
}
