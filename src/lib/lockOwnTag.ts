/**
 * A lock's **own tag**: `lock-<product handle>`. Tags are shared (a `b2b` key opens a product to
 * everyone who has `b2b`), so a lock made with chosen customers also gets a tag only those
 * customers hold. Lock Management and a product's Lock Access tab list the holders of this tag as
 * the lock's customers, and hide the tag itself (it is internal). Shared here so neither feature
 * imports the other.
 */
export const OWN_TAG_PREFIX = 'lock-'

const MAX_TAG_LENGTH = 255

export function ownLockTag(handle: string): string {
  const slug = handle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${OWN_TAG_PREFIX}${slug || 'products'}`.slice(0, MAX_TAG_LENGTH)
}

/** The lock's own tag among its keys (the one made with it), or null for a lock without one. */
export function findOwnTag(
  tags: readonly string[],
  handle?: string | null,
): string | null {
  const own = handle ? ownLockTag(handle).toLowerCase() : null
  return (
    tags.find((tag) => tag.toLowerCase() === own) ??
    tags.find((tag) => tag.toLowerCase().startsWith(OWN_TAG_PREFIX)) ??
    null
  )
}

/** The tags without the lock's own one — what people chose, as they are shown. */
export const withoutOwnTag = (tags: readonly string[], ownTag: string | null) =>
  ownTag ? tags.filter((tag) => tag.toLowerCase() !== ownTag.toLowerCase()) : [...tags]
