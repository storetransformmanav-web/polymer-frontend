import { ApiError } from '../../../lib/api/ApiError.ts'
import type { DraftErrors } from './collectionDraft.ts'

/** The API's field names → the form's. */
const FIELD_NAMES: Record<string, string> = {
  title: 'title',
  handle: 'handle',
  image_url: 'imageUrl',
  image_alt: 'imageAlt',
  seo_title: 'seoTitle',
  seo_description: 'seoDescription',
  sort_order: 'sortOrder',
  products: 'products',
  products_add: 'products',
  products_remove: 'products',
  rules: 'conditions',
}

/**
 * A 422's `errors: [{ field: 'rules.conditions.0.condition', message }]` as the form's errors
 * (`conditions.0.condition`); a 409 (title or handle already taken) on the title or handle box.
 */
export function fieldErrorsFrom(error: unknown): DraftErrors {
  if (!(error instanceof ApiError)) return {}
  const errors: DraftErrors = {}
  const list = (error.data as { errors?: unknown } | undefined)?.errors
  if (Array.isArray(list)) {
    for (const item of list) {
      const field = String((item as { field?: unknown }).field ?? '')
      const message = String((item as { message?: unknown }).message ?? '')
      if (!field || !message) continue
      const conditions = /^rules\.conditions\.(\d+)\.(\w+)/.exec(field)
      const key = conditions
        ? `conditions.${conditions[1]}.${conditions[2]}`
        : (FIELD_NAMES[field.split('.')[0]] ?? null)
      if (key && !errors[key]) errors[key] = message
    }
  }
  if (error.status === 409) {
    const target = /handle/i.test(error.message) ? 'handle' : 'title'
    errors[target] ??= error.message
  }
  return errors
}
