import type { ComponentType } from 'react'
import { HistoryIcon, XIcon, type IconProps } from './icons.tsx'

export interface OpenTab {
  id: string
  /** What the tab says (a handle, a name…). */
  label: string
  /** Hover text. */
  title?: string
}

interface OpenTabsBarProps {
  tabs: OpenTab[]
  /** The record whose details are showing, or null on the list. */
  activeId: string | null
  /** The strip's accessible name, e.g. "Open products". */
  navLabel: string
  /** The first button, which returns to the list, e.g. "All Products". */
  listLabel: string
  /** The small word on each tab, e.g. "Product". */
  kind: string
  /** The accessible name of the history icon, e.g. "Opened products". */
  historyLabel: string
  icon: ComponentType<IconProps>
  onShowList: () => void
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onClear: () => void
}

/**
 * Browser-style strip of opened records: the first button returns to the list, each
 * record is a tab you can switch to or close. Switching is instant — details are cached
 * in Redux. Hidden until there's a tab. Shared by Products, Customers and Orders.
 */
export function OpenTabsBar({
  tabs,
  activeId,
  navLabel,
  listLabel,
  kind,
  historyLabel,
  icon: Icon,
  onShowList,
  onSelect,
  onClose,
  onClear,
}: OpenTabsBarProps) {
  if (tabs.length === 0) return null

  return (
    <nav
      aria-label={navLabel}
      className="border-border bg-bg flex items-stretch rounded-xl border"
    >
      <button
        type="button"
        onClick={onShowList}
        aria-label={listLabel}
        aria-current={activeId === null ? 'page' : undefined}
        className={`text-text flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-3 text-[0.85rem] font-semibold transition-colors ${
          activeId === null ? 'border-accent' : 'hover:border-border border-transparent'
        }`}
      >
        <Icon width={16} height={16} />
        <span className="hidden sm:inline" aria-hidden="true">
          {listLabel}
        </span>
      </button>

      <span className="border-border text-text-muted flex shrink-0 items-center border-r px-3">
        <HistoryIcon width={16} height={16} aria-label={historyLabel} />
      </span>

      <ul className="flex min-w-0 flex-1 [scrollbar-width:none] items-stretch gap-1 overflow-x-auto px-2 [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <li
              key={tab.id}
              className={`flex shrink-0 items-center border-b-2 ${
                active ? 'border-accent' : 'border-transparent'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                aria-current={active ? 'page' : undefined}
                title={tab.title}
                className="hover:bg-surface flex cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent py-1.5 pr-1 pl-2.5 text-[0.8rem] transition-colors"
              >
                <Icon width={14} height={14} className="text-accent" />
                <span className="text-text-muted text-[0.62rem] font-bold tracking-wider uppercase">
                  {kind}
                </span>
                <span className="max-w-32 truncate font-semibold">{tab.label}</span>
              </button>
              <button
                type="button"
                aria-label={`Close ${tab.label}`}
                onClick={() => onClose(tab.id)}
                className="text-text-muted hover:text-danger flex cursor-pointer items-center border-none bg-transparent p-1.5 transition-colors"
              >
                <XIcon width={12} height={12} />
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={onClear}
        className="border-border text-text-muted hover:text-danger flex shrink-0 cursor-pointer items-center gap-1.5 border-0 border-l bg-transparent px-4 text-[0.72rem] font-bold tracking-wide uppercase transition-colors"
      >
        <XIcon width={14} height={14} />
        Clear
      </button>
    </nav>
  )
}
