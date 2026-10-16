import '@testing-library/jest-dom/vitest'

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
