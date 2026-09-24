import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProductsPage } from './ProductsPage.jsx'

describe('ProductsPage', () => {
  it('shows a loading state, then the mock products', async () => {
    render(<ProductsPage />)

    expect(screen.getByText('Loading products…')).toBeInTheDocument()
    expect(await screen.findByText('Kraft Paper Bag — Small')).toBeInTheDocument()
  })

  it('filters products by category', async () => {
    const user = userEvent.setup()
    render(<ProductsPage />)

    await screen.findByText('Kraft Paper Bag — Small')
    expect(screen.getByText('Double-Wall Coffee Cup 8oz')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Category'), 'cups')

    expect(screen.queryByText('Kraft Paper Bag — Small')).not.toBeInTheDocument()
    expect(screen.getByText('Double-Wall Coffee Cup 8oz')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear all/i }))
    expect(screen.getByText('Kraft Paper Bag — Small')).toBeInTheDocument()
  })
})
