import { useCallback, useEffect, useMemo, useState } from 'react'
import { shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { useShops } from '../../../hooks/useShops.ts'
import type { UserCreateBody } from '../../../lib/api/endpoints.ts'
import { UserDeleteDialog, type UserToDelete } from '../components/UserDeleteDialog.tsx'
import { UserFormPanel } from '../components/UserFormPanel.tsx'
import { UsersList } from '../components/UsersList.tsx'
import { UsersToolbar } from '../components/UsersToolbar.tsx'
import { useCreateUser } from '../hooks/useCreateUser.ts'
import { useRoles } from '../hooks/useRoles.ts'
import { useUsers } from '../hooks/useUsers.ts'
import { userName } from '../utils/format.ts'

/** How long the "user added" confirmation stays on screen. */
const NOTICE_MS = 8000

/**
 * Users: the CRM's staff accounts, with search, role and status filters,
 * paging and an "Add user" slide-over. Data comes from TanStack Query (see
 * useUsers), so revisiting a page or filter is instant and a new user
 * appears as soon as the list refetches.
 */
export function UsersPage() {
  const users = useUsers()
  const roles = useRoles()
  const { shops } = useShops()
  const createUser = useCreateUser()
  const { filters, data } = users
  const { clearError } = createUser

  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // The user a trash button asked to delete (the dialog confirms).
  const [deleting, setDeleting] = useState<UserToDelete | null>(null)
  const closeDelete = useCallback(() => setDeleting(null), [])

  const shopNames = useMemo(
    () => Object.fromEntries(shops.map((shop) => [shopValue(shop), shopLabel(shop)])),
    [shops],
  )

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  const openPanel = useCallback(() => {
    clearError()
    setNotice(null)
    setAdding(true)
  }, [clearError])

  const closePanel = useCallback(() => {
    clearError()
    setAdding(false)
  }, [clearError])

  async function handleCreate(body: UserCreateBody) {
    const user = await createUser.create(body)
    setAdding(false)
    setNotice(`${userName(user)} (${user.email}) was added. They can now sign in.`)
    // Back to the first page: that's where the list is refetched.
    users.setFilters({ page: 1 })
  }

  function handleDeleted(user: UserToDelete, message: string) {
    setDeleting(null)
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
      <UsersToolbar
        filters={filters}
        roles={roles.roles}
        total={data?.total ?? null}
        hasFilters={users.hasFilters}
        onChange={users.setFilters}
        onReset={users.resetFilters}
        onAdd={openPanel}
      />

      {notice && <FormMessage tone="success">{notice}</FormMessage>}

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

        <UsersList
          items={users.items}
          isPending={users.isPending}
          error={users.error}
          hasFilters={users.hasFilters}
          isStale={users.isShowingPrevious}
          shopNames={shopNames}
          onDelete={(user) => {
            setNotice(null)
            setDeleting({ id: user.id, name: userName(user), email: user.email })
          }}
          onRetry={users.retry}
          onClearFilters={users.resetFilters}
        />

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

      {deleting && (
        <UserDeleteDialog
          key={`delete-${deleting.id}`}
          user={deleting}
          onClose={closeDelete}
          onDone={(message) => handleDeleted(deleting, message)}
        />
      )}

      {adding && (
        <UserFormPanel
          roles={roles.roles}
          rolesError={roles.error}
          onRetryRoles={roles.retry}
          shops={shops}
          onCreate={handleCreate}
          isCreating={createUser.isCreating}
          error={createUser.error}
          onClearError={clearError}
          onClose={closePanel}
        />
      )}
    </div>
  )
}
