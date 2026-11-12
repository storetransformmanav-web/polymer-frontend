import { useEffect, useRef, useState } from 'react'
import { isColumnVisible, type ColumnConfig } from '../../lib/columnConfig.ts'
import { ColumnsIcon, EyeIcon, EyeOffIcon, GripIcon } from './icons.tsx'
import { PopoverButton } from './PopoverButton.tsx'

interface ColumnsMenuProps<Id extends string> {
  config: ColumnConfig<Id>
  /** A column's name as the menu words it. */
  labelOf: (id: Id) => string
  onToggle: (id: Id) => void
  /** Put `id` where `target` is. */
  onMove: (id: Id, target: Id) => void
  onReset: () => void
}

const ICON_BUTTON =
  'text-text-muted hover:text-accent flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 transition-colors'

/**
 * The icon button at the end of a list's search row that opens the **Columns** menu, after the
 * store admin's: every column with a drag handle (or ↑ / ↓ on it) to put it in order and an eye to
 * show or hide it, and a Reset. A table's first column and its Actions are always there, so they
 * are not listed. The choice itself lives in `useColumnConfig`; this only draws it.
 */
export function ColumnsMenu<Id extends string>({
  config,
  labelOf,
  onToggle,
  onMove,
  onReset,
}: ColumnsMenuProps<Id>) {
  const [dragging, setDragging] = useState<Id | null>(null)
  const [over, setOver] = useState<Id | null>(null)
  const handles = useRef(new Map<Id, HTMLButtonElement>())
  // After a keyboard move the row is drawn in its new place: give the handle its focus back.
  const refocus = useRef<Id | null>(null)

  useEffect(() => {
    if (refocus.current) {
      handles.current.get(refocus.current)?.focus()
      refocus.current = null
    }
  }, [config.order])

  function moveBy(id: Id, step: -1 | 1) {
    const target = config.order[config.order.indexOf(id) + step]
    if (!target) return
    refocus.current = id
    onMove(id, target)
  }

  return (
    <PopoverButton
      label="Columns"
      icon={ColumnsIcon}
      iconOnly
      chevron={false}
      align="right"
    >
      {() => (
        <div className="w-72 max-w-[calc(100vw-2rem)]">
          <div className="flex items-center justify-between px-2 pt-1 pb-1">
            <span className="text-text-muted text-[0.8rem] font-semibold">Columns</span>
            <button
              type="button"
              onClick={onReset}
              className="text-accent cursor-pointer border-none bg-transparent p-0 text-[0.75rem] font-semibold hover:underline"
            >
              Reset
            </button>
          </div>

          <ul className="max-h-[min(58svh,26rem)] overflow-y-auto">
            {config.order.map((id) => {
              const label = labelOf(id)
              const visible = isColumnVisible(config, id)
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move'
                    // Firefox starts no drag without data.
                    event.dataTransfer.setData('text/plain', id)
                    setDragging(id)
                  }}
                  onDragOver={(event) => {
                    if (!dragging) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    if (over !== id) setOver(id)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (dragging) onMove(dragging, id)
                    setDragging(null)
                    setOver(null)
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                  className={`flex items-center gap-1 rounded-md px-1 py-0.5 text-[0.85rem] ${
                    dragging === id ? 'opacity-40' : ''
                  } ${
                    over === id && dragging && dragging !== id
                      ? 'bg-accent-tint'
                      : 'hover:bg-accent-tint/60'
                  }`}
                >
                  <button
                    type="button"
                    ref={(element) => {
                      if (element) handles.current.set(id, element)
                      else handles.current.delete(id)
                    }}
                    aria-label={`Move ${label}`}
                    title="Drag to reorder, or press the up and down arrow keys"
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault()
                        moveBy(id, event.key === 'ArrowUp' ? -1 : 1)
                      }
                    }}
                    className={`${ICON_BUTTON} cursor-grab active:cursor-grabbing`}
                  >
                    <GripIcon width={14} height={14} />
                  </button>
                  <span
                    className={`min-w-0 flex-1 truncate ${visible ? '' : 'text-text-muted'}`}
                  >
                    {label}
                  </span>
                  <button
                    type="button"
                    aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
                    onClick={() => onToggle(id)}
                    className={`${ICON_BUTTON} ${visible ? 'text-text' : ''}`}
                  >
                    {visible ? (
                      <EyeIcon width={16} height={16} />
                    ) : (
                      <EyeOffIcon width={16} height={16} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </PopoverButton>
  )
}
