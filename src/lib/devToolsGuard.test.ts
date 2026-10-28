import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installDevToolsGuard, isDevToolsShortcut, isEditable } from './devToolsGuard.ts'

type Mods = { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }

const key = (code: string, mods: Mods = {}, character = code) => ({
  code,
  key: character,
  ctrlKey: mods.ctrl ?? false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
  metaKey: mods.meta ?? false,
})

describe('isDevToolsShortcut', () => {
  it.each([
    ['F12', key('F12')],
    ['Shift+F12', key('F12', { shift: true })],
    ['Ctrl+F12', key('F12', { ctrl: true })],
    ['Ctrl+Shift+I (Inspect)', key('KeyI', { ctrl: true, shift: true }, 'I')],
    ['Ctrl+Shift+J (console)', key('KeyJ', { ctrl: true, shift: true }, 'J')],
    ['Ctrl+Shift+C (element picker)', key('KeyC', { ctrl: true, shift: true }, 'C')],
    ['Ctrl+Shift+K (Firefox console)', key('KeyK', { ctrl: true, shift: true }, 'K')],
    ['Ctrl+U (view source)', key('KeyU', { ctrl: true }, 'u')],
    // On a Mac, Option changes the character (Option+I types ˆ): the physical key still counts.
    ['Cmd+Option+I', key('KeyI', { meta: true, alt: true }, 'ˆ')],
    ['Cmd+Option+J', key('KeyJ', { meta: true, alt: true }, '∆')],
    ['Cmd+Option+C', key('KeyC', { meta: true, alt: true }, 'ç')],
    ['Cmd+Option+U (view source)', key('KeyU', { meta: true, alt: true }, '¨')],
  ])('catches %s', (_name, event) => {
    expect(isDevToolsShortcut(event)).toBe(true)
  })

  it.each([
    ['a plain letter', key('KeyI', {}, 'i')],
    ['Ctrl+I (italic)', key('KeyI', { ctrl: true }, 'i')],
    ['Ctrl+B (bold)', key('KeyB', { ctrl: true }, 'b')],
    ['Ctrl+C (copy)', key('KeyC', { ctrl: true }, 'c')],
    ['Ctrl+V (paste)', key('KeyV', { ctrl: true }, 'v')],
    ['Ctrl+S', key('KeyS', { ctrl: true }, 's')],
    ['Ctrl+F (find)', key('KeyF', { ctrl: true }, 'f')],
    ['Ctrl+A (select all)', key('KeyA', { ctrl: true }, 'a')],
    ['Ctrl+Z (undo)', key('KeyZ', { ctrl: true }, 'z')],
    ['Ctrl+Shift+Z (redo)', key('KeyZ', { ctrl: true, shift: true }, 'Z')],
    ['Ctrl+Shift+P', key('KeyP', { ctrl: true, shift: true }, 'P')],
    ['Cmd+U on a Mac (underline, not view source)', key('KeyU', { meta: true }, 'u')],
    ['Cmd+I on a Mac (italic)', key('KeyI', { meta: true }, 'i')],
    ['Cmd+Shift+I', key('KeyI', { meta: true, shift: true }, 'I')],
    ['Ctrl+Alt+I', key('KeyI', { ctrl: true, alt: true })],
    ['Ctrl+Shift+U', key('KeyU', { ctrl: true, shift: true }, 'U')],
    ['Tab', key('Tab')],
    ['Shift+Tab', key('Tab', { shift: true })],
    ['Enter', key('Enter')],
    ['Space', key('Space', {}, ' ')],
    ['Escape', key('Escape')],
    ['an arrow key', key('ArrowDown')],
    ['F11 (full screen)', key('F11')],
    ['F5 (reload)', key('F5')],
    ['Ctrl+Plus (zoom)', key('Equal', { ctrl: true }, '+')],
  ])('leaves %s alone', (_name, event) => {
    expect(isDevToolsShortcut(event)).toBe(false)
  })
})

describe('isEditable', () => {
  function page(html: string) {
    document.body.innerHTML = html
    return (selector: string) => document.querySelector(selector)
  }

  it.each(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date'])(
    'counts an input of type %s as a text field',
    (type) => {
      const get = page(`<input id="x" type="${type}" />`)
      expect(isEditable(get('#x'))).toBe(true)
    },
  )

  it.each(['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'])(
    'does not count an input of type %s',
    (type) => {
      const get = page(`<input id="x" type="${type}" />`)
      expect(isEditable(get('#x'))).toBe(false)
    },
  )

  it('counts a textarea, a contenteditable area and what is inside it', () => {
    const get = page(
      '<textarea id="t"></textarea><div id="c" contenteditable="true"><p><b id="i">x</b></p></div><div id="e" contenteditable="">y</div>',
    )
    expect(isEditable(get('#t'))).toBe(true)
    expect(isEditable(get('#c'))).toBe(true)
    expect(isEditable(get('#i'))).toBe(true)
    expect(isEditable(get('#e'))).toBe(true)
  })

  it('does not count contenteditable="false", ordinary elements, or no target', () => {
    const get = page(
      '<div id="f" contenteditable="false">x</div><p id="p">y</p><button id="b">z</button>',
    )
    expect(isEditable(get('#f'))).toBe(false)
    expect(isEditable(get('#p'))).toBe(false)
    expect(isEditable(get('#b'))).toBe(false)
    expect(isEditable(null)).toBe(false)
    expect(isEditable(document)).toBe(false)
  })
})

describe('installDevToolsGuard', () => {
  let uninstall: () => void

  beforeEach(() => {
    document.body.innerHTML = `
      <main id="page"><a id="link" href="#x">link</a><button id="btn">go</button></main>
      <form>
        <input id="text" type="text" />
        <input id="email" type="email" />
        <input id="box" type="checkbox" />
        <textarea id="area"></textarea>
        <div id="editor" contenteditable="true"><p id="para">hello</p></div>
        <div id="locked" contenteditable="false">locked</div>
      </form>`
    uninstall = installDevToolsGuard(document)
  })

  afterEach(() => {
    uninstall()
    document.body.innerHTML = ''
  })

  /** Dispatches a key press on an element and says whether the browser's own action was cancelled. */
  function press(selector: string, event: ReturnType<typeof key>): boolean {
    const target = document.querySelector(selector) as Element
    const keydown = new KeyboardEvent('keydown', {
      ...event,
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(keydown)
    return keydown.defaultPrevented
  }

  /** The same for a right-click (the `contextmenu` event, which a menu key or Shift+F10 raises too). */
  function rightClick(selector: string): boolean {
    const target = document.querySelector(selector) as Element
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    target.dispatchEvent(menu)
    return menu.defaultPrevented
  }

  describe('keyboard shortcuts', () => {
    it.each([
      ['F12', key('F12')],
      ['Ctrl+Shift+I', key('KeyI', { ctrl: true, shift: true }, 'I')],
      ['Ctrl+Shift+J', key('KeyJ', { ctrl: true, shift: true }, 'J')],
      ['Ctrl+Shift+C', key('KeyC', { ctrl: true, shift: true }, 'C')],
      ['Ctrl+U', key('KeyU', { ctrl: true }, 'u')],
      ['Cmd+Option+I', key('KeyI', { meta: true, alt: true }, 'ˆ')],
      ['Cmd+Option+U', key('KeyU', { meta: true, alt: true }, '¨')],
    ])('blocks %s on the page', (_name, event) => {
      expect(press('#page', event)).toBe(true)
      expect(press('#btn', event)).toBe(true)
      expect(press('body', event)).toBe(true)
    })

    it('still blocks the tools’ shortcuts inside a text field', () => {
      for (const selector of ['#text', '#area', '#para']) {
        expect(press(selector, key('F12'))).toBe(true)
        expect(press(selector, key('KeyI', { ctrl: true, shift: true }, 'I'))).toBe(true)
        expect(press(selector, key('KeyJ', { ctrl: true, shift: true }, 'J'))).toBe(true)
        expect(press(selector, key('KeyU', { meta: true, alt: true }, '¨'))).toBe(true)
      }
    })

    it('lets Ctrl+U through in a text field and the editor (it is underline there), and blocks it elsewhere', () => {
      const ctrlU = key('KeyU', { ctrl: true }, 'u')
      expect(press('#text', ctrlU)).toBe(false)
      expect(press('#email', ctrlU)).toBe(false)
      expect(press('#area', ctrlU)).toBe(false)
      expect(press('#editor', ctrlU)).toBe(false)
      expect(press('#para', ctrlU)).toBe(false)

      expect(press('#page', ctrlU)).toBe(true)
      expect(press('#box', ctrlU)).toBe(true)
      expect(press('#locked', ctrlU)).toBe(true)
    })

    it('leaves every ordinary key alone — navigation, forms, editing, zoom', () => {
      const ordinary = [
        key('Tab'),
        key('Tab', { shift: true }),
        key('Enter'),
        key('Space', {}, ' '),
        key('Escape'),
        key('ArrowDown'),
        key('ArrowUp'),
        key('Home'),
        key('KeyA', { ctrl: true }, 'a'),
        key('KeyC', { ctrl: true }, 'c'),
        key('KeyV', { ctrl: true }, 'v'),
        key('KeyX', { ctrl: true }, 'x'),
        key('KeyZ', { ctrl: true }, 'z'),
        key('KeyI', { ctrl: true }, 'i'),
        key('KeyB', { ctrl: true }, 'b'),
        key('KeyF', { ctrl: true }, 'f'),
        key('KeyS', { ctrl: true }, 's'),
        key('F5'),
        key('F11'),
        key('KeyI', {}, 'i'),
      ]
      for (const selector of ['#page', '#link', '#btn', '#text', '#area', '#editor']) {
        for (const event of ordinary) expect(press(selector, event)).toBe(false)
      }
    })

    it('cannot be got around by a component that stops the event from travelling', () => {
      document
        .querySelector('#btn')!
        .addEventListener('keydown', (event) => event.stopPropagation())

      expect(press('#btn', key('F12'))).toBe(true)
    })
  })

  describe('the right-click menu', () => {
    it('is blocked on the page, links, buttons and non-text controls', () => {
      for (const selector of ['body', '#page', '#link', '#btn', '#box', '#locked']) {
        expect(rightClick(selector)).toBe(true)
      }
    })

    it('is kept in text fields, so paste and spell-check still work', () => {
      for (const selector of ['#text', '#email', '#area', '#editor', '#para']) {
        expect(rightClick(selector)).toBe(false)
      }
    })
  })

  describe('taking it off', () => {
    it('stops blocking once uninstalled', () => {
      uninstall()

      expect(press('#page', key('F12'))).toBe(false)
      expect(press('#page', key('KeyU', { ctrl: true }, 'u'))).toBe(false)
      expect(rightClick('#page')).toBe(false)
    })
  })
})
