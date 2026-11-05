import { useId, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { ChevronDownIcon } from '../../components/ui/icons.tsx'
import type { NavItem } from '../router/navigation.ts'
import { NavItemLink } from './NavItemLink.tsx'

/**
 * A sidebar link with sub-links (Inventory → Lock Management). Clicking the link opens its page
 * **and** shows the sub-links beneath it; the chevron opens and closes them on its own. The
 * sub-links start open when one of them is the current page, so you never land on a page whose
 * menu entry is hidden; after the first click the user's choice wins.
 */
export function NavItemWithSubmenu({ item }: { item: NavItem }) {
  const children = item.children ?? []
  const { pathname } = useLocation()
  const panelId = useId()
  const hasActiveChild = children.some((child) =>
    matchPath({ path: child.to, end: child.end ?? false }, pathname),
  )
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? hasActiveChild

  return (
    <div>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <NavItemLink item={item} collapsed={false} onClick={() => setUserOpen(true)} />
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? 'Hide' : 'Show'} ${children.map((child) => child.label).join(', ')}`}
          onClick={() => setUserOpen(!open)}
          className="text-text-muted hover:bg-bg hover:text-text flex shrink-0 cursor-pointer items-center rounded-lg border-none bg-transparent p-2"
        >
          <ChevronDownIcon
            width={16}
            height={16}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Same height animation as the group; `inert` keeps the closed links out of the tab order. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-all duration-200 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <ul className="border-border mt-1 ml-5 flex flex-col gap-1 border-l pl-2">
            {children.map((child) => (
              <li key={child.to}>
                <NavItemLink item={child} collapsed={false} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
