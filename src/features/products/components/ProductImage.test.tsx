import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductImage } from './ProductImage.tsx'

describe('ProductImage', () => {
  it('shows an https image, lazily, without sending a referrer to the image host', () => {
    render(<ProductImage src="https://cdn.shopify.com/s/files/a.jpg" alt="Desk" />)

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
    const { container } = render(<ProductImage src={src} alt="Desk" />)

    expect(container.querySelector('img')).toBeNull() // nothing is ever loaded
    expect(screen.getByRole('img', { name: 'Desk' }).tagName).toBe('SPAN')
  })
})
