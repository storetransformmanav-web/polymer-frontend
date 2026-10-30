import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// `findBy…` / `waitFor` give up after 1 s by default. Under load (a slow or busy machine, many
// test workers at once) the first render of a page can take longer than that, which showed up as
// "Unable to find an element" on one machine and not another. They return as soon as the thing
// appears, so a longer limit only matters when a test really is failing.
configure({ asyncUtilTimeout: 5000 })

// Anything a test leaves in this tab's storage (e.g. images the products slice
// remembers across a refresh) must not leak into the next test.
afterEach(() => {
  if (typeof window !== 'undefined') window.sessionStorage.clear()
})

// jsdom has no layout, but the rich-text editor (ProseMirror) asks ranges for their
// rectangles when it scrolls the cursor into view. Empty answers are enough.
if (typeof Range !== 'undefined') {
  const empty = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getClientRects ??= empty
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
}
if (typeof document !== 'undefined') {
  document.elementFromPoint ??= () => null
}
