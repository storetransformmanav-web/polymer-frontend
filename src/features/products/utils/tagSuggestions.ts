/** The values that contain `query` (any case), those starting with it first. */
export function matchSuggestions(
  suggestions: readonly string[],
  query: string,
  taken: readonly string[],
): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const chosen = new Set(taken.map((tag) => tag.toLowerCase()))
  const hits = suggestions.filter(
    (value) => !chosen.has(value.toLowerCase()) && value.toLowerCase().includes(needle),
  )
  const starts = (value: string) => (value.toLowerCase().startsWith(needle) ? 0 : 1)
  return hits.sort(
    (a, b) => starts(a) - starts(b) || a.localeCompare(b, 'en', { sensitivity: 'base' }),
  )
}
