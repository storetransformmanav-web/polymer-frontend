import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DescriptionAccordion } from './DescriptionAccordion.tsx'

const SECTIONS = [
  {
    title: 'Product Description',
    content: '<p>Hippo Microwave Containers with Lids.</p>',
  },
  {
    title: 'Product Information',
    content:
      '<p><strong>Capacity:</strong></p><table><tbody><tr><td>MC01H</td><td>500ml</td></tr></tbody></table>',
  },
]

const row = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^${title}`) })

describe('DescriptionAccordion', () => {
  it('shows one bordered row per section, all closed to begin with', () => {
    render(<DescriptionAccordion sections={SECTIONS} multi />)

    expect(row('Product Description')).toHaveAttribute('aria-expanded', 'false')
    expect(row('Product Information')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/Hippo Microwave/)).not.toBeInTheDocument()
  })

  it('opens a section to show its text with its structure, and closes it again', async () => {
    const user = userEvent.setup()
    render(<DescriptionAccordion sections={SECTIONS} multi />)

    await user.click(row('Product Information'))

    const region = screen.getByRole('region', { name: 'Product Information' })
    expect(within(region).getByText('Capacity:').tagName).toBe('STRONG')
    expect(within(region).getByRole('table')).toBeInTheDocument()
    expect(row('Product Information')).toHaveAttribute('aria-expanded', 'true')

    await user.click(row('Product Information'))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('lets several sections be open together when the store allows it', async () => {
    const user = userEvent.setup()
    render(<DescriptionAccordion sections={SECTIONS} multi />)

    await user.click(row('Product Description'))
    await user.click(row('Product Information'))

    expect(screen.getAllByRole('region')).toHaveLength(2)
  })

  it('keeps one section open at a time when the store says so', async () => {
    const user = userEvent.setup()
    render(<DescriptionAccordion sections={SECTIONS} multi={false} />)

    await user.click(row('Product Description'))
    await user.click(row('Product Information'))

    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(row('Product Description')).toHaveAttribute('aria-expanded', 'false')
    expect(row('Product Information')).toHaveAttribute('aria-expanded', 'true')
  })

  it('never turns a section’s HTML into live markup', async () => {
    const user = userEvent.setup()
    render(
      <DescriptionAccordion
        multi
        sections={[
          {
            title: 'Notes',
            content:
              '<p>Fine</p><script>window.pwned = 1</script><img src="x" onerror="alert(1)">',
          },
        ]}
      />,
    )

    await user.click(row('Notes'))

    expect(screen.getByText('Fine')).toBeInTheDocument()
    expect(document.querySelector('script, img')).toBeNull()
  })

  it('says so when a section has no text', async () => {
    const user = userEvent.setup()
    render(<DescriptionAccordion multi sections={[{ title: 'Delivery', content: '' }]} />)

    await user.click(row('Delivery'))

    expect(screen.getByText('Nothing in this section.')).toBeInTheDocument()
  })
})
