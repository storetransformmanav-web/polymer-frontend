import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SafeHtml } from './SafeHtml.tsx'

const show = (html: string) => render(<SafeHtml html={html} />)

describe('SafeHtml', () => {
  it('keeps the structure of a description: paragraphs, bold, lists and a table', () => {
    show(
      '<p>Intro</p><p><strong>Specifications:</strong></p><ul><li>Microwave-safe</li><li>Stackable</li></ul>' +
        '<figure class="table"><table><tbody><tr><td><strong>Product Code</strong></td><td>Capacity</td></tr>' +
        '<tr><td>MC01H</td><td>500ml</td></tr></tbody></table></figure>',
    )

    expect(screen.getByText('Intro').tagName).toBe('P')
    expect(screen.getByText('Specifications:').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Microwave-safe',
      'Stackable',
    ])
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(within(table).getByText('500ml').tagName).toBe('TD')
  })

  it('never lets anything run: scripts, styles, frames, images and forms are dropped with their content', () => {
    const { container } = show(
      '<p>Safe</p><script>window.hacked = 1</script><style>p{display:none}</style>' +
        '<iframe src="https://evil.example"></iframe><img src="https://evil.example/x.png" onerror="alert(1)">' +
        '<form action="https://evil.example"><input name="card"><button>Pay</button></form><svg><circle /></svg>',
    )

    expect(screen.getByText('Safe')).toBeInTheDocument()
    expect(
      container.querySelector('script, style, iframe, img, form, input, button, svg'),
    ).toBeNull()
    expect(container).not.toHaveTextContent('hacked')
    expect(container).not.toHaveTextContent('Pay')
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined()
  })

  it('copies no attribute from the HTML — no styles, classes, ids or event handlers', () => {
    const { container } = show(
      '<div><p style="color:red" class="x" id="y" onclick="alert(1)" data-a="b">Plain</p></div>',
    )

    const paragraph = screen.getByText('Plain')
    expect(paragraph).not.toHaveAttribute('style')
    expect(paragraph).not.toHaveAttribute('onclick')
    expect(paragraph).not.toHaveAttribute('id')
    expect(paragraph).not.toHaveAttribute('data-a')
    expect(paragraph).not.toHaveClass('x')
    // Only the app's own classes exist; nothing the HTML carried.
    expect(container.querySelector('[onclick], [style], [id], [data-a]')).toBeNull()
  })

  it('links only to http(s) addresses, opened safely; any other link is just its text', () => {
    const { container } = show(
      '<a href="https://example.com/a">Good</a> <a href="javascript:alert(1)">Bad</a> <a href="data:text/html,x">Data</a>',
    )

    const good = screen.getByRole('link', { name: 'Good' })
    expect(good).toHaveAttribute('href', 'https://example.com/a')
    expect(good).toHaveAttribute('target', '_blank')
    expect(good).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('link', { name: 'Bad' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Data' })).not.toBeInTheDocument()
    // The refused links are still readable, as plain text.
    expect(container).toHaveTextContent('Good Bad Data')
  })

  it('turns an empty paragraph (a non-breaking space) into a small gap, not a blank line of text', () => {
    const { container } = show('<p>One</p><p>&nbsp;</p><p> </p><p>Two</p>')

    const gaps = container.querySelectorAll('p[aria-hidden="true"]')
    expect(gaps).toHaveLength(2)
    expect(container).toHaveTextContent('OneTwo')
    // Screen readers meet only the real paragraphs.
    expect(screen.getAllByText(/One|Two/)).toHaveLength(2)
  })

  it('shows the content of a harmless tag it does not know', () => {
    show('<section><font color="red">Kept</font></section>')

    expect(screen.getByText('Kept')).toBeInTheDocument()
  })

  it('keeps a table cell’s span, within reason', () => {
    show(
      '<table><tbody><tr><td colspan="2">Wide</td><td colspan="9999">Huge</td></tr></tbody></table>',
    )

    expect(screen.getByText('Wide')).toHaveAttribute('colspan', '2')
    expect(screen.getByText('Huge')).not.toHaveAttribute('colspan')
  })

  it('shows plain text and empty input without fuss', () => {
    const { container, rerender } = show('Just text')
    expect(container).toHaveTextContent('Just text')

    rerender(<SafeHtml html="" />)
    expect(container).toHaveTextContent('')
  })
})
