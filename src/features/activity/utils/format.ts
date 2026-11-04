import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import type { ActivityItem } from '../../../lib/api/endpoints.ts'

/** "list_products" → "List products" — the machine action name, readable. */
export function actionLabel(action: string): string {
  const words = action.replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action
}

// Record identifiers a person can't read: UUIDs, Shopify GIDs, "#17516" and long numbers.
const ID_PATTERNS = [
  /gid:\/\/shopify\/\S+/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /#\d+\b/g,
  /\b\d{5,}\b/g,
]

/**
 * The summary as a sentence for people: record IDs are dropped ("Kairav viewed inventory
 * 1228e801-…" → "Kairav viewed inventory", "viewed order 17516" → "viewed an order") — the
 * details panel still has the full request. Falls back to the action's name.
 */
export function readableSummary(
  summary: string | null | undefined,
  action: string,
): string {
  let text = summary ?? ''
  for (const pattern of ID_PATTERNS) text = text.replace(pattern, ' ')
  text = text
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,:;-]+$/, '')
    .trim()
  // "viewed order" (its ID removed) reads better as "viewed an order".
  if (text !== (summary ?? '').trim()) {
    text = text.replace(
      /\b(viewed|updated|deleted|created|synced|pushed|checked|opened|edited) (order|product|customer|user|inventory item|variant|lock|collection|image)$/i,
      (_, verb: string, noun: string) =>
        `${verb} ${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`,
    )
  }
  return text || actionLabel(action)
}

/** The acting user's name for a log row: name, else email, else "System" (no user). */
export function actorName(user: ActivityItem['user']): string {
  return user?.full_name?.trim() || user?.email || 'System'
}

/** Reads (GET) are neutral; writes stand out, deletes most of all. */
export function methodTone(method: string | null | undefined): BadgeTone {
  switch (method?.toUpperCase()) {
    case 'POST':
      return 'success'
    case 'PUT':
    case 'PATCH':
      return 'warning'
    case 'DELETE':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** 2xx success, 3xx neutral, 4xx warning, 5xx danger. */
export function statusTone(code: number | null | undefined): BadgeTone {
  if (code === null || code === undefined) return 'neutral'
  if (code < 300) return 'success'
  if (code < 400) return 'neutral'
  if (code < 500) return 'warning'
  return 'danger'
}

/** "81 ms" / "1.2 s" / "—". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** Pretty-printed JSON for display as plain text (never as markup). */
export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? ''
}

/** True for an object with at least one key (the API sends `null` or `{}` when empty). */
export function hasEntries(value: Record<string, unknown> | null | undefined): boolean {
  return value !== null && value !== undefined && Object.keys(value).length > 0
}
