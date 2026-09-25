import { useAppDispatch, useAppSelector } from '../app/store/hooks.ts'
import { sidebarCollapsedSet } from '../app/store/uiSlice.ts'

type SetCollapsed = (value: boolean | ((current: boolean) => boolean)) => void

/**
 * Whether the app sidebar is collapsed to icons-only, backed by the
 * `ui` Redux slice (persisted to localStorage there). Returns a
 * `[value, setValue]` tuple, same shape as `useState`, so call sites
 * didn't need to change when this moved off local component state.
 */
export function useSidebarCollapsed(): [boolean, SetCollapsed] {
  const collapsed = useAppSelector((state) => state.ui.sidebarCollapsed)
  const dispatch = useAppDispatch()

  const setCollapsed: SetCollapsed = (value) => {
    const next = typeof value === 'function' ? value(collapsed) : value
    dispatch(sidebarCollapsedSet(next))
  }

  return [collapsed, setCollapsed]
}
