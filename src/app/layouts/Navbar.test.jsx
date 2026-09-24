import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Navbar } from './Navbar.jsx'

describe('Navbar', () => {
  it('marks the current route as active', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass(
      'navbar__link--active',
    )
    expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveClass(
      'navbar__link--active',
    )
  })

  it('links to every top-level section', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'href',
      '/orders',
    )
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/products',
    )
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'href',
      '/inventory',
    )
  })
})
