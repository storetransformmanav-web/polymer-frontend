import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob } from './download.ts'

describe('downloadBlob', () => {
  let clicked: { download: string; href: string }[]

  beforeEach(() => {
    clicked = []
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:test-url')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ download: this.download, href: this.href })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicks a temporary link that downloads the file under the given name, and cleans up', () => {
    const blob = new Blob(['a,b'], { type: 'text/csv' })
    downloadBlob('products.csv', blob)

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked).toEqual([{ download: 'products.csv', href: 'blob:test-url' }])
    expect(document.querySelector('a[download]')).toBeNull()
    // The address is released shortly afterwards, not before the download starts.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url')
  })
})
