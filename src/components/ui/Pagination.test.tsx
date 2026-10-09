import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getPageItems } from '../../lib/pagination.ts'
import { Pagination } from './Pagination.tsx'

describe('getPageItems', () => {
  it('lists every page when there are few', () => {
    expect(getPageItems(2, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('elides the middle at the start, middle and end of a long list', () => {
    expect(getPageItems(1, 279)).toEqual([1, 2, 3, 4, 5, 'gap', 279])
    expect(getPageItems(140, 279)).toEqual([1, 'gap', 139, 140, 141, 'gap', 279])
    expect(getPageItems(279, 279)).toEqual([1, 'gap', 275, 276, 277, 278, 279])
  })

  it('shows a single skipped page instead of an ellipsis', () => {
    expect(getPageItems(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20])
  })
})

describe('Pagination', () => {
  it('marks the current page, disables Previous on page 1, and reports changes', async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(<Pagination page={1} totalPages={10} onPageChange={onPageChange} />)

    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)
    await user.click(screen.getByRole('button', { name: 'Page 10' }))
    expect(onPageChange).toHaveBeenLastCalledWith(10)
  })

  it('disables Next on the last page', () => {
    render(<Pagination page={3} totalPages={3} onPageChange={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
