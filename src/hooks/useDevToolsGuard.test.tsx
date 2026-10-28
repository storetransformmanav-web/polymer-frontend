import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDevToolsGuard } from './useDevToolsGuard.ts'

function f12(): boolean {
  const event = new KeyboardEvent('keydown', {
    code: 'F12',
    key: 'F12',
    bubbles: true,
    cancelable: true,
  })
  document.body.dispatchEvent(event)
  return event.defaultPrevented
}

function rightClick(): boolean {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  document.body.dispatchEvent(event)
  return event.defaultPrevented
}

describe('useDevToolsGuard', () => {
  it('blocks the shortcuts and the right-click menu while it is on', () => {
    const { unmount } = renderHook(() => useDevToolsGuard(true))

    expect(f12()).toBe(true)
    expect(rightClick()).toBe(true)
    unmount()
  })

  it('does nothing while it is off', () => {
    const { unmount } = renderHook(() => useDevToolsGuard(false))

    expect(f12()).toBe(false)
    expect(rightClick()).toBe(false)
    unmount()
  })

  it('follows the setting as it changes', () => {
    const { rerender, unmount } = renderHook(({ on }) => useDevToolsGuard(on), {
      initialProps: { on: false },
    })
    expect(f12()).toBe(false)

    rerender({ on: true })
    expect(f12()).toBe(true)

    rerender({ on: false })
    expect(f12()).toBe(false)
    unmount()
  })

  it('takes the guard off when the page unmounts it', () => {
    const { unmount } = renderHook(() => useDevToolsGuard(true))
    unmount()

    expect(f12()).toBe(false)
    expect(rightClick()).toBe(false)
  })

  it('installs it only once however often it re-renders', () => {
    const { rerender, unmount } = renderHook(() => useDevToolsGuard(true))
    rerender()
    rerender()
    unmount()

    // Every install was matched by a removal: nothing is left behind.
    expect(f12()).toBe(false)
  })
})
