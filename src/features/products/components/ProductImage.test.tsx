import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  localMediaAdded,
  localMediaStatus,
  type LocalMediaItem,
} from '../../../app/store/productsSlice.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductImage } from './ProductImage.tsx'

const chosen = (key: string, previewUrl = `blob:${key}`): LocalMediaItem => ({
  key,
  name: `${key}.png`,
  mediaType: 'IMAGE',
  previewUrl,
  status: 'uploading',
})

describe('ProductImage', () => {
  it('shows an https image, lazily, without sending a referrer to the image host', () => {
    renderWithProviders(
      <ProductImage src="https://cdn.shopify.com/s/files/a.jpg" alt="Desk" />,
    )

    const image = screen.getByRole('img', { name: 'Desk' })
    expect(image).toHaveAttribute('src', 'https://cdn.shopify.com/s/files/a.jpg')
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  it.each([
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:image/svg+xml,<svg onload=alert(1)>'],
    ['a file: URL', 'file:///etc/passwd'],
    ['a relative path', '/uploads/a.jpg'],
    ['garbage', 'not a url'],
    ['an empty string', ''],
    ['null', null],
  ])('falls back to the placeholder instead of using %s', (_label, src) => {
    const { container } = renderWithProviders(<ProductImage src={src} alt="Desk" />)

    expect(container.querySelector('img')).toBeNull() // nothing is ever loaded
    expect(screen.getByRole('img', { name: 'Desk' }).tagName).toBe('SPAN')
  })

  describe('a picture just chosen from the computer', () => {
    it('is shown at once while the store has no picture for the product', () => {
      const view = renderWithProviders(
        <ProductImage src={null} alt="Tray" productId="p1" />,
      )
      act(() => {
        view.store.dispatch(
          localMediaAdded({ id: 'p1', items: [chosen('a')], baseline: 0 }),
        )
      })

      expect(screen.getByRole('img', { name: 'Tray' })).toHaveAttribute('src', 'blob:a')
    })

    it('gives way to the store’s own picture as soon as there is one', () => {
      const view = renderWithProviders(
        <ProductImage src="https://cdn.shopify.com/a.jpg" alt="Tray" productId="p1" />,
      )
      act(() => {
        view.store.dispatch(
          localMediaAdded({ id: 'p1', items: [chosen('a')], baseline: 0 }),
        )
      })

      expect(screen.getByRole('img', { name: 'Tray' })).toHaveAttribute(
        'src',
        'https://cdn.shopify.com/a.jpg',
      )
    })

    it('is for its own product only, and never for a file that failed', () => {
      const view = renderWithProviders(
        <>
          <ProductImage src={null} alt="Other" productId="p2" />
          <ProductImage src={null} alt="Failed" productId="p1" />
        </>,
      )
      act(() => {
        view.store.dispatch(
          localMediaAdded({ id: 'p1', items: [chosen('a')], baseline: 0 }),
        )
      })
      act(() => {
        view.store.dispatch(
          localMediaStatus({ id: 'p1', keys: ['a'], status: 'failed', error: 'No' }),
        )
      })

      expect(screen.getByRole('img', { name: 'Other' }).tagName).toBe('SPAN')
      expect(screen.getByRole('img', { name: 'Failed' }).tagName).toBe('SPAN')
    })

    it('only ever uses an in-memory (blob:) address of its own, never another kind', () => {
      const view = renderWithProviders(
        <ProductImage src={null} alt="Tray" productId="p1" />,
      )
      act(() => {
        view.store.dispatch(
          localMediaAdded({
            id: 'p1',
            items: [chosen('a', 'https://evil.example.com/a.png')],
            baseline: 0,
          }),
        )
      })

      expect(screen.getByRole('img', { name: 'Tray' }).tagName).toBe('SPAN')
    })
  })
})
