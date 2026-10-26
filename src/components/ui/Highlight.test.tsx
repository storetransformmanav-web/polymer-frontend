import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Highlight, HighlightQuery, splitMatches } from './Highlight.tsx'

describe('splitMatches', () => {
  it('marks every occurrence, ignoring case, and keeps the original text', () => {
    expect(splitMatches('Hippo Bag in a hippo box', 'HIPPO')).toEqual([
      { text: 'Hippo', match: true },
      { text: ' Bag in a ', match: false },
      { text: 'hippo', match: true },
      { text: ' box', match: false },
    ])
  })

  it('marks each word of a multi-word search, longest first', () => {
    expect(splitMatches('Pizza Box White', 'box pizza')).toEqual([
      { text: 'Pizza', match: true },
      { text: ' ', match: false },
      { text: 'Box', match: true },
      { text: ' White', match: false },
    ])
  })

  it('treats the search as plain text, never as a pattern', () => {
    expect(splitMatches('a.b (c) [d] a+b', '.')).toEqual([
      { text: 'a', match: false },
      { text: '.', match: true },
      { text: 'b (c) [d] a+b', match: false },
    ])
    expect(() => splitMatches('x', '(')).not.toThrow()
    expect(() => splitMatches('x', '[')).not.toThrow()
    expect(() => splitMatches('x', '\\')).not.toThrow()
  })

  it('returns the text whole when there is no search or no match', () => {
    expect(splitMatches('Hippo', '')).toEqual([{ text: 'Hippo', match: false }])
    expect(splitMatches('Hippo', '   ')).toEqual([{ text: 'Hippo', match: false }])
    expect(splitMatches('Hippo', 'zzz')).toEqual([{ text: 'Hippo', match: false }])
    expect(splitMatches('', 'a')).toEqual([{ text: '', match: false }])
  })
})

describe('Highlight', () => {
  it('draws what was searched for in <mark> elements, taking the query from HighlightQuery', () => {
    const { container } = render(
      <HighlightQuery query="bag">
        <p>
          <Highlight text="Hippo Bag Holder" />
        </p>
      </HighlightQuery>,
    )

    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('Bag')
    expect(marks[0].className).toContain('bg-highlight')
    // The sentence is still whole text for anyone reading it.
    expect(container.querySelector('p')).toHaveTextContent('Hippo Bag Holder')
  })

  it('marks nothing without a search, and shows an empty value as nothing', () => {
    const { container } = render(
      <p>
        <Highlight text="Hippo Bag" />
        <Highlight text={null} />
      </p>,
    )
    expect(container.querySelector('mark')).toBeNull()
    expect(screen.getByText('Hippo Bag')).toBeInTheDocument()
  })

  it('never turns API text into markup', () => {
    const { container } = render(
      <HighlightQuery query="img">
        <Highlight text={'<img src=x onerror=alert(1)> and img'} />
      </HighlightQuery>,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelectorAll('mark').length).toBe(2)
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)> and img')
  })
})
