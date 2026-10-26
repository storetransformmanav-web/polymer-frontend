import { createContext, useContext, type ReactNode } from 'react'

const QueryContext = createContext('')

/**
 * Tells every `<Highlight>` below it what was searched for. A list page wraps its results in
 * this with the search text it sent to the API, so the words you typed show up marked in the
 * rows — without threading a prop through every table cell.
 */
export function HighlightQuery({
  query,
  children,
}: {
  query: string
  children: ReactNode
}) {
  return <QueryContext.Provider value={query}>{children}</QueryContext.Provider>
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits `text` around every occurrence of any word of `query` (case-insensitive, longest
 * word first), as `{ text, match }` pieces. Pure, so it can be tested without rendering.
 */
export function splitMatches(
  text: string,
  query: string,
): { text: string; match: boolean }[] {
  const words = [...new Set(query.trim().split(/\s+/).filter(Boolean))]
  if (words.length === 0 || !text) return [{ text, match: false }]
  words.sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'gi')
  const pieces: { text: string; match: boolean }[] = []
  let last = 0
  for (const found of text.matchAll(pattern)) {
    const start = found.index ?? 0
    if (start > last) pieces.push({ text: text.slice(last, start), match: false })
    pieces.push({ text: found[0], match: true })
    last = start + found[0].length
  }
  if (last < text.length) pieces.push({ text: text.slice(last), match: false })
  return pieces.length > 0 ? pieces : [{ text, match: false }]
}

/**
 * `text`, with what was searched for marked in yellow (a `<mark>`). Plain text in, React
 * elements out — never markup — so API text can't inject anything. Without a search it is
 * just the text.
 */
export function Highlight({
  text,
  query,
}: {
  text: string | null | undefined
  query?: string
}) {
  const fromContext = useContext(QueryContext)
  const value = text ?? ''
  const pieces = splitMatches(value, query ?? fromContext)
  if (pieces.length === 1 && !pieces[0].match) return <>{value}</>
  return (
    <>
      {pieces.map((piece, index) =>
        piece.match ? (
          <mark key={index} className="bg-highlight text-highlight-text rounded-sm px-px">
            {piece.text}
          </mark>
        ) : (
          piece.text
        ),
      )}
    </>
  )
}
