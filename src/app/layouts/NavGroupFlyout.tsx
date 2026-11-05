import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, matchPath, useLocation } from 'react-router-dom'
import type { NavGroup } from '../router/navigation.ts'

/** Space between the rail and the menu. */
const GAP = 12
/** Room a menu row takes, and the heading and padding, to keep a tall menu inside the window. */
const ROW_HEIGHT = 44
const CHROME_HEIGHT = 64

/**
 * A sidebar group in the icon rail: just its icon; clicking it opens a small card to the
 * right of the rail with the group's name and its pages (icon + label), so a heading that
 * holds several pages is still one click away when the sidebar is closed.
 *
 * The card is drawn on top of the page (a portal, fixed to the screen) so the rail's
 * scrolling area never clips it. It closes on Escape, on a click elsewhere, when a page is
 * chosen, and on scroll or resize (a card fixed to the screen would drift from its icon).
 */
export function NavGroupFlyout({ group }: { group: NavGroup }) {
  const { label, icon: Icon, items } = group
  const { pathname } = useLocation()
  const hasActiveItem = items.some((item) =>
    matchPath({ path: item.to, end: item.end ?? false }, pathname),
  )
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined

    function close() {
      setOpen(false)
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      close()
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    const height = CHROME_HEIGHT + items.length * ROW_HEIGHT
    setPlace({
      left: rect.right + GAP,
      top: Math.max(GAP, Math.min(rect.top, window.innerHeight - height - GAP)),
    })
    setOpen(true)
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={label}
        onClick={toggle}
        className={`hover:bg-bg hover:text-text flex w-full cursor-pointer items-center justify-center rounded-lg border-none px-2.5 py-2.5 text-sm font-medium ${
          open
            ? 'bg-bg text-text'
            : hasActiveItem
              ? 'bg-accent-tint text-accent'
              : 'text-text-muted bg-transparent'
        }`}
      >
        <Icon className="shrink-0" />
        <span className="sr-only">{label}</span>
      </button>

      {open &&
        place &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="group"
            aria-label={label}
            style={{ left: place.left, top: place.top }}
            className="border-border bg-bg fixed z-50 min-w-60 rounded-2xl border p-2 shadow-lg"
          >
            <p className="text-text-muted px-3 pt-2 pb-2 text-[0.7rem] font-bold tracking-wider uppercase">
              {label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const ItemIcon = item.icon
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `hover:bg-accent-tint/60 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9rem] font-semibold no-underline transition-colors ${
                          isActive ? 'bg-accent-tint text-accent' : 'text-text'
                        }`
                      }
                    >
                      <ItemIcon className="shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
