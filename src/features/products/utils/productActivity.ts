function plainValue(value: unknown, depth: number): string {
  if (value === null || value === undefined || depth > 6) return ''
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return ''
    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(text)
        if (typeof parsed === 'object' && parsed !== null) {
          return plainValue(parsed, depth + 1)
        }
      } catch {
        return text
      }
    }
    return text
  }
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((item) => plainValue(item, depth + 1))
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = plainValue(item, depth + 1)
        return text ? `${key}: ${text}` : ''
      })
      .filter(Boolean)
      .join(' · ')
  }
  return ''
}

/** Formats activity values as readable text without JSON punctuation. */
export function productActivityValueText(value: unknown): string {
  return plainValue(value, 0) || '—'
}
