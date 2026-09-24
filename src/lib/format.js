/**
 * Shared formatting helpers. Generic (no feature knowledge), used by
 * both orders and products — keep new formatters here rather than
 * duplicating `Intl` calls per feature.
 */

export function formatCurrency(amount, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

export function formatDate(isoString) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(isoString))
}
