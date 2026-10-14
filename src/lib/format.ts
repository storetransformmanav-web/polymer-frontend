/**
 * Shared formatting helpers. Generic (no feature knowledge), used by
 * both orders and products — keep new formatters here rather than
 * duplicating `Intl` calls per feature.
 */

export function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

/**
 * Formats an amount the API sends as a decimal string (e.g. "170.00").
 * Returns an em dash when there's no usable number, and falls back to a
 * plain "CODE 12.30" if the currency code isn't one Intl recognises.
 */
export function formatPrice(
  value: string | number | null | undefined,
  currency?: string | null,
): string {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—'

  try {
    return formatCurrency(amount, currency || 'GBP')
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoString))
}

/** "14 Oct 2026, 10:59" — a timestamp with its time (for tooltips and "last seen" cells). */
export function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString))
}

/** "14 Oct 2026, 11:04:03" — down to the second, for log entries. */
export function formatTimestamp(isoString: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(isoString))
}

/** "Priya Shah" → "PS": up to two initials, ignoring extra spaces. */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
