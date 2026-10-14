import { Link } from 'react-router-dom'
import { Logo } from '../../components/ui/Logo.tsx'
import { ChevronsLeftIcon, LogoutIcon } from '../../components/ui/icons.tsx'
import { useAuth } from '../../hooks/useAuth.ts'
import { useMediaQuery } from '../../hooks/useMediaQuery.ts'
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed.ts'
import { NAV_ENTRIES, isNavGroup } from '../router/navigation.ts'
import { initials, useCurrentUser } from './currentUser.ts'
import { NavAccordion } from './NavAccordion.tsx'
import { NavItemLink } from './NavItemLink.tsx'

/**
 * Primary left-hand navigation. Collapses to icons-only (persisted via
 * `useSidebarCollapsed`) for a denser layout on smaller screens or by
 * user preference.
 */
export function Navbar() {
  const [preferCollapsed, setCollapsed] = useSidebarCollapsed()
  // Phones always get the icon rail — a 232px sidebar would leave no room for
  // content — so the saved preference only applies from tablet width up.
  const isWide = useMediaQuery('(min-width: 768px)')
  const collapsed = preferCollapsed || !isWide
  const { logout } = useAuth()
  const currentUser = useCurrentUser()

  return (
    <nav
      className={`border-border bg-surface sticky top-0 flex h-svh flex-shrink-0 flex-col border-r transition-[width] duration-[180ms] ease-in-out ${
        collapsed ? 'w-[72px]' : 'w-[232px]'
      }`}
    >
      <div
        className={`border-border flex h-16 items-center gap-2 border-b ${
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        {!collapsed && <Logo />}
        <button
          type="button"
          className={`border-border bg-bg text-text-muted hover:text-accent hover:border-accent h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
            isWide ? 'inline-flex' : 'hidden'
          }`}
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronsLeftIcon className={collapsed ? 'rotate-180' : ''} />
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ENTRIES.map((entry) =>
          isNavGroup(entry) ? (
            <li key={entry.label}>
              <NavAccordion group={entry} collapsed={collapsed} />
            </li>
          ) : (
            <li key={entry.to}>
              <NavItemLink item={entry} collapsed={collapsed} />
            </li>
          ),
        )}
      </ul>

      <div
        className={`border-border flex items-center gap-2 border-t py-3.5 ${
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-accent text-accent-contrast flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {initials(currentUser.name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-text truncate text-sm font-semibold">
                {currentUser.name}
              </span>
              <span
                className="text-text-muted truncate text-[0.72rem]"
                title={currentUser.email}
              >
                {currentUser.email}
              </span>
            </span>
          </div>
        )}
        <Link
          to="/login"
          onClick={logout}
          className="text-text-muted hover:bg-bg hover:text-danger flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          title="Log out"
          aria-label="Log out"
        >
          <LogoutIcon />
        </Link>
      </div>
    </nav>
  )
}
