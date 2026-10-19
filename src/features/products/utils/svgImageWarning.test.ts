import { describe, expect, it } from 'vitest'
import { svgImageWarning } from './format.ts'

describe('svgImageWarning', () => {
  it('warns about a placehold.co address without an image extension (it answers with an SVG)', () => {
    const warning = svgImageWarning('https://placehold.co/600x600?text=Small+Carrier+Bag')

    expect(warning).toMatch(/SVG/)
    expect(warning).toMatch(/add \.png/)
  })

  it('is happy once placehold.co is asked for a raster image', () => {
    expect(svgImageWarning('https://placehold.co/600x600.png?text=Bag')).toBeNull()
    expect(svgImageWarning('https://placehold.co/600x600.jpg')).toBeNull()
  })

  it('warns about any .svg address', () => {
    expect(svgImageWarning('https://cdn.example.com/logo.svg')).toMatch(/SVG/)
    expect(svgImageWarning('https://cdn.example.com/LOGO.SVG?v=2')).toMatch(/SVG/)
  })

  it('leaves ordinary addresses alone, with or without an extension', () => {
    expect(svgImageWarning('https://cdn.example.com/a.jpg')).toBeNull()
    expect(svgImageWarning('https://cdn.shopify.com/s/files/1/0001/a')).toBeNull()
    expect(svgImageWarning('not an address')).toBeNull()
  })
})
