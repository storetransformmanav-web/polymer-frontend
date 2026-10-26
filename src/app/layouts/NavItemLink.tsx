import { NavLink } from 'react-router-dom'
import type { NavItem } from '../router/navigation.ts'

interface NavItemLinkProps {
  item: NavItem
  /** Icon-rail mode: label becomes a tooltip / screen-reader text. */
  collapsed: boolean
}

/** One sidebar link — used for top-level entries and inside accordions. */
export function NavItemLink({ item, collapsed }: NavItemLinkProps) {
  const { to, label, end, icon: Icon } = item

  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `text-text-muted hover:bg-bg hover:text-text flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium no-underline ${
          collapsed ? 'justify-center' : ''
        } ${isActive ? 'bg-accent-tint text-accent' : ''}`
      }
    >
      <Icon className="shrink-0" />
      <span className={collapsed ? 'sr-only' : ''}>{label}</span>
    </NavLink>
  )
}
