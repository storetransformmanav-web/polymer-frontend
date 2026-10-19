import { describe, expect, it } from 'vitest'
import { classifySync, readableSyncError, syncFailureHint } from './sync.ts'

// What the backend returned for a failed alt-text push (a Python-style dump of Shopify's error).
const ACCESS_DENIED =
  "[{'message': 'Access denied for fileUpdate field. Required access: `write_files` access scope or `write_themes` access scope. Also: Users must have edit files permissions.', 'locations': [{'line': 3, 'column': 3}], 'extensions': {'code': 'ACCESS_DENIED', 'documentation': 'https://shopify.dev/api/usage/access-scopes', 'requiredAccess': '`write_files` access scope or `write_themes` access scope. Also: Users must have edit files permissions.'}, 'path': ['fileUpdate']}]"

describe('readableSyncError', () => {
  it("pulls the store's message out of the backend's error dump", () => {
    expect(readableSyncError(ACCESS_DENIED)).toBe(
      'Access denied for fileUpdate field. Required access: `write_files` access scope or `write_themes` access scope. Also: Users must have edit files permissions.',
    )
  })

  it('reads a JSON-style dump too, and unescapes quotes', () => {
    expect(readableSyncError('{"message": "Handle \\"x\\" is taken"}')).toBe(
      'Handle "x" is taken',
    )
  })

  it('returns plain text unchanged', () => {
    expect(readableSyncError('Shopify is unavailable')).toBe('Shopify is unavailable')
  })
})

describe('syncFailureHint', () => {
  it('says Retry will not help when the store refused for a missing permission', () => {
    expect(syncFailureHint(ACCESS_DENIED)).toMatch(/Retry will not help/)
  })

  it('has nothing to add for other failures', () => {
    expect(syncFailureHint('Shopify is unavailable')).toBeNull()
    expect(syncFailureHint("[{'message': 'Handle has already been taken'}]")).toBeNull()
  })
})

describe('classifySync', () => {
  it('treats failures, finished pushes and everything else apart', () => {
    expect(classifySync('failed')).toBe('failed')
    expect(classifySync('synced')).toBe('synced')
    expect(classifySync('pending')).toBe('syncing')
  })
})
