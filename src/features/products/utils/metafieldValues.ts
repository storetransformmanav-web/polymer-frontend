/**
 * What a metafield's value must look like, by its kind — the one check the Add product form and the
 * product page's editor share, run when a value is typed and again before anything is saved.
 */

const NOT_A_LIST =
  'A list needs a JSON array: values in square brackets, e.g. ["Plastic", "Paper"]'

/** The entries of a list value (a JSON array of texts or numbers), or null when it isn't one. */
export function readList(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    return parsed.every((item) => typeof item === 'string' || typeof item === 'number')
      ? parsed.map(String)
      : null
  } catch {
    return null
  }
}

/** A real calendar day written as `YYYY-MM-DD`. */
function isDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** `YYYY-MM-DDTHH:MM(:SS)`, optionally followed by a time zone (`Z` or `+01:00`). */
function isDateTime(value: string): boolean {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(
      value,
    )
  if (!match) return false
  return (
    isDay(match[1]) &&
    Number(match[2]) < 24 &&
    Number(match[3]) < 60 &&
    Number(match[4] ?? 0) < 60
  )
}

const URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'sms:', 'tel:']

function isWebAddress(value: string): boolean {
  if (/\s/.test(value)) return false
  try {
    const url = new URL(value)
    if (!URL_PROTOCOLS.includes(url.protocol)) return false
    // A web address needs a host; mail and phone addresses need something after the colon.
    return url.protocol.startsWith('http') ? url.hostname !== '' : url.pathname !== ''
  } catch {
    return false
  }
}

const isColour = (value: string) => /^#[0-9a-f]{6}$/i.test(value)

/** Why one single value of this kind is wrong, or null. Kinds without a rule are accepted. */
function checkOne(type: string, value: string): string | null {
  switch (type) {
    case 'url':
      return isWebAddress(value)
        ? null
        : 'Enter a full web address, e.g. https://example.com'
    case 'date':
      return isDay(value) ? null : 'Enter a real date (YYYY-MM-DD)'
    case 'date_time':
      return isDateTime(value) ? null : 'Enter a real date and time'
    case 'color':
      return isColour(value) ? null : 'Enter a hex colour, e.g. #1a73e8'
    case 'boolean':
      return value === 'true' || value === 'false' ? null : 'Choose Yes or No'
    case 'number_integer':
      return /^-?\d+$/.test(value) ? null : 'Enter a whole number'
    case 'number_decimal':
      return /^-?\d+(\.\d+)?$/.test(value) ? null : 'Enter a number'
    case 'single_line_text_field':
      return /[\r\n]/.test(value) ? 'Use a single line of text' : null
    case 'json':
      try {
        JSON.parse(value)
        return null
      } catch {
        return 'Enter valid JSON, e.g. {"care": "Hand wash"}'
      }
    default:
      return null
  }
}

/**
 * Why a (non-empty) value does not fit its kind, or null when it does. A `list.*` value is a JSON
 * array with at least one entry, and every entry is checked as its own kind.
 */
export function validateMetafieldValue(type: string, value: string): string | null {
  const text = value.trim()
  if (!type.startsWith('list.')) return checkOne(type, text)

  const items = readList(text)
  if (!items) return NOT_A_LIST
  const inner = type.slice(5)
  if (items.length === 0) return 'Add at least one value'
  for (const [index, item] of items.entries()) {
    if (item.trim() === '') return `Value ${index + 1} is empty`
    const problem = checkOne(inner, item.trim())
    if (problem) return `Value ${index + 1}: ${problem}`
  }
  return null
}
