import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PopoverButton } from '../../../components/ui/PopoverButton.tsx'
import { SearchIcon, UsersIcon, XIcon, CheckIcon } from '../../../components/ui/icons.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { api, type UserItem } from '../../../lib/api/endpoints.ts'

const PAGE_SIZE = 50

const nameOf = (
  user: Pick<UserItem, 'full_name' | 'first_name' | 'last_name' | 'email'>,
) =>
  user.full_name.trim() ||
  [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
  user.email

/** The list inside the open dropdown: its own search box, and the people the backend finds. */
function MemberList({
  value,
  onPick,
}: {
  value: string
  onPick: (id: string, name: string) => void
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useDebouncedField('', (next) => setSearch(next))
  const query = useQuery({
    // Asked only while the dropdown is open; the backend does the searching (name or email).
    queryKey: ['attendance', 'members', search],
    queryFn: () =>
      api.users.list({
        page: 1,
        page_size: PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
      }),
    staleTime: 60_000,
  })
  const users = query.data?.items ?? []
  const total = query.data?.total ?? users.length

  return (
    <div className="w-72 max-w-[calc(100vw-2rem)]">
      <div className="border-border bg-surface focus-within:border-accent mb-1.5 flex h-9 items-center gap-2 rounded-lg border px-2.5">
        <SearchIcon width={15} height={15} className="text-text-muted shrink-0" />
        <input
          autoFocus
          type="search"
          aria-label="Search members"
          placeholder="Search members…"
          maxLength={80}
          value={debounced}
          onChange={(event) => setDebounced(event.target.value)}
          className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.82rem] outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </div>
      <ul role="listbox" aria-label="Members" className="max-h-64 overflow-y-auto">
        <li role="option" aria-selected={value === ''}>
          <button
            type="button"
            onClick={() => onPick('', '')}
            className="hover:bg-accent-tint/60 text-text flex w-full cursor-pointer items-center justify-between rounded-md border-none bg-transparent px-2.5 py-2 text-left text-[0.82rem] font-semibold"
          >
            All members
            {value === '' && <CheckIcon width={14} height={14} className="text-accent" />}
          </button>
        </li>
        {query.isPending && (
          <li className="text-text-muted px-2.5 py-2 text-[0.8rem]">Loading members…</li>
        )}
        {query.isError && (
          <li role="alert" className="text-danger px-2.5 py-2 text-[0.8rem]">
            Couldn&apos;t load the members.
          </li>
        )}
        {users.map((user) => (
          <li key={user.id} role="option" aria-selected={value === user.id}>
            <button
              type="button"
              onClick={() => onPick(user.id, nameOf(user))}
              className="hover:bg-accent-tint/60 text-text flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-none bg-transparent px-2.5 py-2 text-left text-[0.82rem]"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{nameOf(user)}</span>
                <span className="text-text-muted truncate text-[0.74rem]">
                  {user.email}
                </span>
              </span>
              {value === user.id && (
                <CheckIcon width={14} height={14} className="text-accent shrink-0" />
              )}
            </button>
          </li>
        ))}
        {!query.isPending && !query.isError && users.length === 0 && (
          <li className="text-text-muted px-2.5 py-2 text-[0.8rem]">No members found.</li>
        )}
      </ul>
      {total > users.length && (
        <p className="text-text-muted px-2.5 pt-1.5 text-[0.72rem]">
          Showing {users.length} of {total} — type to narrow the list.
        </p>
      )}
    </div>
  )
}

/**
 * The **Member** filter: a dropdown button holding its own search box and the people the backend
 * lists (`GET /users?search=`, asked only while it is open). Choosing one narrows the attendance to
 * that employee (`employee` = their CRM user id); "All members" clears it. A chosen member's name is
 * shown on the button with a ✕ beside it.
 */
export function MemberFilter({
  value,
  onChange,
}: {
  /** The chosen member's CRM user id ('' = everyone). */
  value: string
  onChange: (id: string) => void
}) {
  // The chosen person's name, kept from the moment they were picked.
  const [name, setName] = useState('')

  return (
    <div className="flex items-center gap-2">
      <PopoverButton label={value ? name || 'Member' : 'Member'} icon={UsersIcon}>
        {(close) => (
          <MemberList
            value={value}
            onPick={(id, picked) => {
              setName(picked)
              onChange(id)
              close()
            }}
          />
        )}
      </PopoverButton>
      {value && (
        <button
          type="button"
          aria-label="Clear member"
          onClick={() => {
            setName('')
            onChange('')
          }}
          className="text-text-muted hover:text-danger cursor-pointer border-none bg-transparent p-0.5"
        >
          <XIcon width={14} height={14} />
        </button>
      )}
    </div>
  )
}
