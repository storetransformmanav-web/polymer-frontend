import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionListItem } from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { CollectionsList } from './CollectionsList.tsx'

function row(
  id: string,
  title: string,
  type: string | null,
  updatedAt: string | null = '2026-11-01T10:00:00Z',
): CollectionListItem {
  return {
    id,
    shopify_id: 1,
    title,
    handle: `${id}-handle`,
    collection_type: type,
    editable: type !== 'smart',
    sort_order: 'BEST_SELLING',
    image_url: null,
    products_count: 3,
    shop: { key: 'polymer-uk', name: 'Polymer UK' },
    shopify_updated_at: updatedAt,
  } as CollectionListItem
}

function renderList(items: CollectionListItem[]) {
  return renderWithProviders(
    <CollectionsList
      items={items}
      isPending={false}
      error={null}
      hasFilters={false}
      isStale={false}
      showStore={false}
      onOpen={vi.fn()}
      onRetry={vi.fn()}
      onClearFilters={vi.fn()}
    />,
  )
}

describe('CollectionsList — the type column', () => {
  it('shows each collection’s type exactly as the API sent it', () => {
    renderList([
      row('a', 'Summer picks', 'smart'),
      row('b', 'Hand made', 'custom'),
      row('c', 'Brand new kind', 'dynamic_rules'),
    ])

    const smart = screen.getByRole('row', { name: /Summer picks/ })
    const custom = screen.getByRole('row', { name: /Hand made/ })
    const other = screen.getByRole('row', { name: /Brand new kind/ })
    expect(within(smart).getByText('Smart')).toBeInTheDocument()
    expect(within(custom).getByText('Custom')).toBeInTheDocument()
    expect(within(other).getByText('Dynamic rules')).toBeInTheDocument()
  })

  it('has no hard-coded "Manual" or "Automated" label', () => {
    renderList([row('a', 'Summer picks', 'smart'), row('b', 'Hand made', 'custom')])
    expect(screen.queryByText('Manual')).not.toBeInTheDocument()
    expect(screen.queryByText('Automated')).not.toBeInTheDocument()
  })

  it('shows a dash when the API sends no type', () => {
    renderList([row('a', 'No type yet', null)])
    const only = screen.getByRole('row', { name: /No type yet/ })
    expect(within(only).queryByText('Smart')).not.toBeInTheDocument()
    expect(within(only).queryByText('Custom')).not.toBeInTheDocument()
    expect(within(only).getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('CollectionsList — columns and the Updated date', () => {
  // A Wednesday, 12:00 in London (winter): "now" is fixed so the days are known.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('has no Product order column', () => {
    renderList([row('a', 'Summer picks', 'smart')])
    const headers = screen
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(headers).toEqual(['Collection', 'Type', 'Products', 'Updated', 'Actions'])
    expect(screen.queryByText('Best selling')).not.toBeInTheDocument()
  })

  it('shows Updated by how long ago, yesterday, weekday or date', () => {
    renderList([
      row('a', 'Today one', 'smart', '2026-11-11T11:44:00Z'),
      row('b', 'Yesterday one', 'smart', '2026-11-10T16:30:00Z'),
      row('c', 'Weekday one', 'smart', '2026-11-09T16:30:00Z'),
      row('d', 'Older one', 'smart', '2026-10-10T10:00:00Z'),
      row('e', 'Never one', 'smart', null),
    ])
    const cellOf = (name: RegExp) =>
      within(screen.getByRole('row', { name })).getAllByRole('cell')[3]

    expect(cellOf(/Today one/)).toHaveTextContent('16 minutes ago')
    expect(cellOf(/Yesterday one/)).toHaveTextContent('Yesterday, 4:30 PM')
    expect(cellOf(/Weekday one/)).toHaveTextContent('Monday, 4:30 PM')
    expect(cellOf(/Older one/)).toHaveTextContent('October 10, 2026')
    expect(cellOf(/Never one/)).toHaveTextContent('—')
  })

  it('keeps the exact date and time as the hover text', () => {
    renderList([row('a', 'Today one', 'smart', '2026-11-11T11:44:00Z')])
    const cell = within(screen.getByRole('row', { name: /Today one/ })).getAllByRole(
      'cell',
    )[3]
    expect(within(cell).getByText('16 minutes ago')).toHaveAttribute(
      'title',
      expect.stringMatching(/11 Nov 2026/),
    )
  })

  it('still has the View button on every row', () => {
    renderList([row('a', 'Summer picks', 'smart')])
    expect(
      screen.getByRole('button', { name: 'View collection Summer picks' }),
    ).toBeInTheDocument()
  })
})
