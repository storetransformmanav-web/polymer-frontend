import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge.tsx'

describe('Badge', () => {
  it('shows its text as a pill in its tone', () => {
    render(<Badge tone="success">Paid</Badge>)

    const pill = screen.getByText('Paid')
    expect(pill.className).toContain('rounded-md')
    expect(pill.className).not.toContain('undefined')
    // The status-pill design: bold capitals, a border in the tone's colour.
    expect(pill.className).toContain('uppercase')
    expect(pill.className).toContain('border-accent/30')
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
    expect(pill.className).toContain('rounded-md')
  })
})
