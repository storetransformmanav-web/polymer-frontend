/**
 * The values that contain `query` (any case), those starting with it first. With nothing
 * typed it lists none — or, with `all`, every value not already taken (alphabetical).
 */
export function matchSuggestions(
  suggestions: readonly string[],
  query: string,
  taken: readonly string[],
  all = false,
): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle && !all) return []
  const chosen = new Set(taken.map((tag) => tag.toLowerCase()))
  const hits = suggestions.filter(
    (value) =>
      !chosen.has(value.toLowerCase()) &&
      (!needle || value.toLowerCase().includes(needle)),
  )
  const starts = (value: string) => (value.toLowerCase().startsWith(needle) ? 0 : 1)
  return hits.sort(
    (a, b) => starts(a) - starts(b) || a.localeCompare(b, 'en', { sensitivity: 'base' }),
  )
}
