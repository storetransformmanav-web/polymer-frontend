import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../../components/ui/ThemeToggle.tsx'
import { ChevronDownIcon, LogoutIcon, UserCogIcon } from '../../components/ui/icons.tsx'
import { CURRENT_USER, initials } from './currentUser.ts'

const AVATAR_BASE =
  'bg-accent text-accent-contrast inline-flex shrink-0 items-center justify-center rounded-full font-bold'
const MENU_ITEM =
  'text-text hover:bg-surface flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm no-underline'

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
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="border-border bg-surface text-text hover:border-accent flex items-center gap-2 rounded-full border py-1.5 pr-2.5 pl-1.5 text-[0.85rem]"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className={`${AVATAR_BASE} h-6.5 w-6.5 text-[0.7rem]`}>
          {initials(CURRENT_USER.name)}
        </span>
        <span className="max-w-40 truncate font-semibold">{CURRENT_USER.name}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <div
          className="border-border bg-bg absolute top-[calc(100%+0.5rem)] right-0 z-20 w-65 rounded-xl border p-3 shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
          role="menu"
        >
          <div className="flex items-center gap-2.5">
            <span className={`${AVATAR_BASE} h-9 w-9 text-sm`}>
              {initials(CURRENT_USER.name)}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[0.9rem] font-semibold">{CURRENT_USER.name}</span>
              <span className="text-text-muted truncate text-[0.78rem]">
                {CURRENT_USER.email}
              </span>
              <span className="bg-accent-tint text-accent mt-1 self-start rounded-full px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide uppercase">
                {CURRENT_USER.role}
              </span>
            </div>
          </div>

          <div className="bg-border my-2.5 h-px" />

          <span className="text-text-muted mb-1.5 block text-[0.68rem] font-bold tracking-wide uppercase">
            Theme
          </span>
          <ThemeToggle />

          <div className="bg-border my-2.5 h-px" />

          {/* TODO: wire up once a profile feature/route exists. */}
          <button
            type="button"
            className={`${MENU_ITEM} cursor-pointer border-none bg-none`}
            role="menuitem"
          >
            <UserCogIcon />
            Update profile
          </button>
          <Link to="/login" className={MENU_ITEM} role="menuitem">
            <LogoutIcon />
            Log out
          </Link>
        </div>
      )}
    </div>
  )
}
