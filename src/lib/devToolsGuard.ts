/**
 * A deterrent against casually opening the browser's developer tools or the page source: it
 * turns off the right-click menu (whose "Inspect" and "View page source" are the usual way in)
 * and the keyboard shortcuts that open the tools.
 *
 * **This is not security.** Everything the page holds — the bundle, the token, every request —
 * is readable by whoever runs the browser, and the tools can still be opened from the browser's
 * own menu, undocked windows, `view-source:` addresses, another browser or by turning scripts
 * off. Real protection is the backend (see "Security" in CLAUDE.md). What this does is stop the
 * one-click routes, without getting in the way of normal use:
 *
 * - A **text field** (an `input` that takes text, a `textarea`, anything `contenteditable` — the
 *   rich-text editor) keeps its right-click menu, so paste, spell-check and the like still work,
 *   and keeps **Ctrl+U**, which is *underline* in the editor.
 * - Every other key and every other click is left exactly as it was: Tab and the arrow keys,
 *   Enter, Escape, Ctrl+C / V / S / F, page zoom…
 *
 * Keys are recognised by the physical key (`event.code`), not the character: with Shift or
 * Option held `event.key` is a different character (`I` or `ˆ`), the code is not.
 */

type KeyInfo = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>

/** Letters that, with the right modifiers, open a tool: Inspect (I), the console (J, and K in Firefox), the element picker (C). */
const TOOL_KEYS = new Set(['KeyI', 'KeyJ', 'KeyC', 'KeyK'])

/**
 * Does this key press open the developer tools or the page source?
 *
 * - **F12**, with or without modifiers.
 * - **Ctrl+Shift+I / J / C / K** (Windows, Linux, ChromeOS: Inspect, console, element picker,
 *   Firefox's console).
 * - **Cmd+Option+I / J / C** (macOS: the same) and **Cmd+Option+U** (macOS: view source).
 * - **Ctrl+U** (Windows, Linux: view source) — see `isEditable` for where it is let through.
 */
export function isDevToolsShortcut(event: KeyInfo): boolean {
  if (event.code === 'F12') return true
  const { ctrlKey, metaKey, altKey, shiftKey, code } = event
  if (ctrlKey && shiftKey && !altKey && !metaKey) return TOOL_KEYS.has(code)
  if (metaKey && altKey && !ctrlKey) return TOOL_KEYS.has(code) || code === 'KeyU'
  return ctrlKey && !shiftKey && !altKey && !metaKey && code === 'KeyU'
}

/** Input types that take typed text (the others — checkbox, button, file… — are not text fields). */
const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

/** Is the event's target somewhere text is typed? */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const field = target.closest('input, textarea, [contenteditable]')
  if (!field) return false
  if (field instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(field.type.toLowerCase())
  }
  if (field instanceof HTMLTextAreaElement) return true
  // `contenteditable="false"` inside an editable area is not editable.
  return field.getAttribute('contenteditable')?.toLowerCase() !== 'false'
}

/**
 * Installs the guard on a document (the page's own, by default). Returns a function that takes
 * it off again. The listeners run first (the capture phase), so a component that stops an event
 * from travelling further can't let a shortcut slip past.
 */
export function installDevToolsGuard(target: Document = document): () => void {
  function onKeyDown(event: KeyboardEvent) {
    if (!isDevToolsShortcut(event)) return
    // Ctrl+U types as *underline* in a text field (the rich-text editor): leave it be there.
    if (event.ctrlKey && event.code === 'KeyU' && isEditable(event.target)) return
    event.preventDefault()
  }

  function onContextMenu(event: MouseEvent) {
    if (isEditable(event.target)) return
    event.preventDefault()
  }

  target.addEventListener('keydown', onKeyDown, { capture: true })
  target.addEventListener('contextmenu', onContextMenu, { capture: true })
  return () => {
    target.removeEventListener('keydown', onKeyDown, { capture: true })
    target.removeEventListener('contextmenu', onContextMenu, { capture: true })
  }
}
