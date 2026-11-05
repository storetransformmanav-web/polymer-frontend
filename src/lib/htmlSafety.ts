/** Elements with no place in a description: they run code, load other pages or collect data. */
const UNSAFE_ELEMENTS = new Set([
  'applet',
  'base',
  'embed',
  'form',
  'frame',
  'frameset',
  'link',
  'math',
  'meta',
  'noscript',
  'object',
  'script',
  'style',
  'svg',
  'template',
])

/** Attributes holding an address. */
const URL_ATTRIBUTES = new Set([
  'action',
  'background',
  'cite',
  'data',
  'formaction',
  'href',
  'poster',
  'src',
  'xlink:href',
])

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const YOUTUBE_EMBED = /^https:\/\/www\.youtube-nocookie\.com\/embed\//i

/** An address with no scheme of its own is relative, and so safe. Hidden characters don't count. */
function isSafeAddress(value: string): boolean {
  // Browsers ignore control characters and spaces inside a scheme ("java\nscript:").
  // eslint-disable-next-line no-control-regex
  const compact = value.replace(/[\u0000- ]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(compact)
  return !scheme || SAFE_PROTOCOLS.has(scheme[1].toLowerCase())
}

function isUnsafeElement(element: Element): boolean {
  const name = element.tagName.toLowerCase()
  if (UNSAFE_ELEMENTS.has(name)) return true
  if (name === 'iframe') return !YOUTUBE_EMBED.test(element.getAttribute('src') ?? '')

  return Array.from(element.attributes).some((attribute) => {
    const key = attribute.name.toLowerCase()
    if (key.startsWith('on') || key === 'srcdoc') return true
    if (URL_ATTRIBUTES.has(key)) return !isSafeAddress(attribute.value)
    if (key === 'style')
      return /javascript:|expression\(|@import|url\(/i.test(attribute.value)
    return false
  })
}

/**
 * Does this HTML hold anything that could run code or load something unwanted where it is shown?
 * It is parsed by `DOMParser` — inert: nothing in it runs or loads. Used by the editor's raw HTML
 * view to decide whether typed HTML must go through the editor's schema before it is saved. It
 * only guards this form: the backend must still check what it stores.
 */
export function hasUnsafeHtml(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('*')).some(isUnsafeElement)
}
