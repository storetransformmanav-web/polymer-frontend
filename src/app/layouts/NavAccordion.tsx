import { useId, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { ChevronDownIcon } from '../../components/ui/icons.tsx'
import type { NavGroup } from '../router/navigation.ts'
import { NavItemLink } from './NavItemLink.tsx'

interface NavAccordionProps {
  group: NavGroup
}

/**
 * A sidebar heading that opens and closes its links. It starts closed, except
 * when the current page is one of its links (so you never land on a page whose
 * menu entry is hidden); after the first click the user's choice wins. (In the
 * icon rail a group is a flyout card instead — see `NavGroupFlyout`.)
 */
export function NavAccordion({ group }: NavAccordionProps) {
  const { label, icon: Icon, items } = group
  const { pathname } = useLocation()
  const panelId = useId()
  const hasActiveItem = items.some((item) =>
    matchPath({ path: item.to, end: item.end ?? false }, pathname),
  )
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? hasActiveItem

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setUserOpen(!open)}
        className={`hover:bg-bg hover:text-text flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2.5 text-left text-sm font-medium ${
          hasActiveItem && !open ? 'text-accent' : 'text-text-muted'
        }`}
      >
        <Icon className="shrink-0" />
        <span className="flex-1">{label}</span>
        <ChevronDownIcon
          width={16}
          height={16}
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* The grid-rows trick animates height without measuring; `inert` keeps
          the closed links out of the tab order. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-all duration-200 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <ul className="border-border mt-1 ml-5 flex flex-col gap-1 border-l pl-2">
            {items.map((item) => (
              <li key={item.to}>
                <NavItemLink item={item} collapsed={false} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
