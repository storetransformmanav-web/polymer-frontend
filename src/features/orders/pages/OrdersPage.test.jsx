import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { OrdersPage } from './OrdersPage.jsx'

describe('OrdersPage', () => {
  it('shows a loading state, then the mock orders', async () => {
    render(<OrdersPage />)

    expect(screen.getByText('Loading orders…')).toBeInTheDocument()
    expect(await screen.findByText('#1040')).toBeInTheDocument()
  })

  it('filters orders by customer type', async () => {
    const user = userEvent.setup()
    render(<OrdersPage />)

    await screen.findByText('#1040')
    expect(screen.getByText('#1042')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Customer'), 'retail')

    expect(screen.queryByText('#1040')).not.toBeInTheDocument()
    expect(screen.getByText('#1042')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByText('#1040')).toBeInTheDocument()
  })
})
