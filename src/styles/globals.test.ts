import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src', 'styles', 'globals.css'), 'utf8')

describe('globals.css', () => {
  it('sets one root text size for every page: 15px (93.75%), a little smaller than the browser default', () => {
    expect(css).toMatch(/html\s*\{\s*font-size:\s*93\.75%;?\s*\}/)
  })

  it('draws bold scrollbars with the sage thumb token', () => {
    expect(css).toMatch(/::-webkit-scrollbar\s*\{[^}]*width:\s*16px/)
    expect(css).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*var\(--color-scrollbar\)/)
  })

  it('paints the body with the warm off-white page colour', () => {
    expect(css).toMatch(/--color-page:\s*#faf9f2/)
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--color-page\)/)
  })
})
