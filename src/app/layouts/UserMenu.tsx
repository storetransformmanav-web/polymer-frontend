import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/ui/ThemeToggle.tsx'
import { ChevronDownIcon, LogoutIcon, UserCogIcon } from '../../components/ui/icons.tsx'
import { CURRENT_USER, initials } from './currentUser.ts'
import './UserMenu.css'

/**
 * Account menu in the AppBar: current user summary, theme control,
 * and account actions. Closes on outside click.
 */
export function UserMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="user-menu__avatar">{initials(CURRENT_USER.name)}</span>
        <span className="user-menu__name">{CURRENT_USER.name}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__summary">
            <span className="user-menu__avatar user-menu__avatar--lg">
              {initials(CURRENT_USER.name)}
            </span>
            <div className="user-menu__summary-text">
              <span className="user-menu__summary-name">{CURRENT_USER.name}</span>
              <span className="user-menu__summary-email">{CURRENT_USER.email}</span>
              <span className="user-menu__role">{CURRENT_USER.role}</span>
            </div>
          </div>

          <div className="user-menu__divider" />

          <span className="user-menu__section-label">Theme</span>
          <ThemeToggle />

          <div className="user-menu__divider" />

          {/* TODO: wire up once a profile feature/route exists. */}
          <button type="button" className="user-menu__item" role="menuitem">
            <UserCogIcon />
            Update profile
          </button>
          <Link to="/login" className="user-menu__item" role="menuitem">
            <LogoutIcon />
            Log out
          </Link>
        </div>
      )}
    </div>
  )
}
