import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge.tsx'

describe('Badge', () => {
  it('shows its text as a pill in its tone', () => {
    render(<Badge tone="success">Paid</Badge>)

    const pill = screen.getByText('Paid')
    expect(pill.className).toContain('rounded-full')
    expect(pill.className).not.toContain('undefined')
  })

  it('takes extra classes, so a column of pills can share one width', () => {
    render(
      <Badge tone="warning" className="w-32 justify-center">
        Pending
      </Badge>,
    )

    const pill = screen.getByText('Pending')
    expect(pill.className).toContain('w-32')
    expect(pill.className).toContain('justify-center')
    expect(pill.className).toContain('rounded-full')
  })
})
