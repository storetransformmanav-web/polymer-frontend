import { describe, expect, it } from 'vitest'
import { frontOrder } from './mediaOrder.ts'

const images = (...ids: string[]) => ids.map((id) => ({ id }))

describe('frontOrder', () => {
  it('moves arrived files in front of the picture that went in with the product', () => {
    // "a" (a variant's) was there first; the store listed the uploaded "c" after it.
    expect(frontOrder(images('a', 'c'), 1, 0, 1)).toEqual(['c', 'a'])
  })

  it('keeps files that were already moved first, and puts the new ones right after them', () => {
    expect(frontOrder(images('c1', 'a', 'c2'), 2, 1, 1)).toEqual(['c1', 'c2', 'a'])
  })

  it('keeps whatever the store listed after the arrived files', () => {
    expect(frontOrder(images('a', 'c', 'x'), 1, 0, 1)).toEqual(['c', 'a', 'x'])
  })

  it('has nothing to do without an older picture to go in front of', () => {
    expect(frontOrder(images('c'), 0, 0, 1)).toBeNull()
    expect(frontOrder(images('c1', 'c2'), 2, 2, 0)).toBeNull()
  })

  it('waits until the product lists every arrived file', () => {
    expect(frontOrder(images('a'), 1, 0, 1)).toBeNull()
  })
})
