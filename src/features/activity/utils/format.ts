import type { BadgeTone } from '../../../components/ui/Badge.tsx'
import type { ActivityItem } from '../../../lib/api/endpoints.ts'

/** "list_products" → "List products" — the machine action name, readable. */
export function actionLabel(action: string): string {
  const words = action.replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action
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
