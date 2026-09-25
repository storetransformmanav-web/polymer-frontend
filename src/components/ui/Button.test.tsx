import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button.tsx'

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('applies the secondary variant styling', () => {
    render(<Button variant="secondary">Cancel</Button>)
    // bg-transparent only appears on the secondary variant — a stand-in
    // for "the variant prop changed which style branch rendered".
    expect(screen.getByRole('button')).toHaveClass('bg-transparent')
  })
})
