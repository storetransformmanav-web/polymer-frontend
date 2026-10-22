import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src', 'styles', 'globals.css'), 'utf8')

describe('globals.css', () => {
  it('sets one root text size for every page: 15px (93.75%), a little smaller than the browser default', () => {
    expect(css).toMatch(/html\s*\{\s*font-size:\s*93\.75%;?\s*\}/)
  })
})
