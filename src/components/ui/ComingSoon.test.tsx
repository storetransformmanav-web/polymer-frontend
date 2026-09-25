import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComingSoon } from './ComingSoon.tsx'

describe('ComingSoon', () => {
  it('renders the given title and a coming soon badge', () => {
    render(<ComingSoon title="Orders" />)
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })
})
