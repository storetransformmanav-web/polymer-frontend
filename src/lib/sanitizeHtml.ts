import DOMPurify from 'dompurify'

/**
 * The one place HTML from outside is made safe. Nothing in this app puts HTML on the page as
 * markup (no React raw-HTML prop and no DOM HTML setter is ever used — a test scans for them): API text
 * is rendered as text, and descriptions are rebuilt as React elements by `SafeHtml`. This sanitizer
 * is the second layer: `SafeHtml` runs everything through it first, and HTML the app *sends* (a
 * product's description and its description sections, which the store shows to its customers) is
 * cleaned with it before it leaves, so a script typed or pasted into a description can never be
 * saved.
 *
 * What survives is what the rich-text editor can make: paragraphs, headings, bold / italic /
 * underline, lists, tables, links (http, https, mailto, tel), https pictures and YouTube embeds
 * (youtube-nocookie only). Scripts, event handlers (`onclick`…), `javascript:` and `data:`
 * addresses, forms, SVG / MathML, stylesheets and styles that fetch or run something are removed.
 */

const purify = DOMPurify(window)

const ALLOWED_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'div',
  'em',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'iframe',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]

const ALLOWED_ATTR = [
  'alt',
  'allow',
  'allowfullscreen',
  'colspan',
  'colwidth',
  'data-youtube-video',
  'frameborder',
  'height',
  'href',
  'loading',
  'rel',
  'rowspan',
  'src',
  'style',
  'target',
  'title',
  'width',
]

const YOUTUBE_EMBED = /^https:\/\/www\.youtube-nocookie\.com\/embed\//i
/** A style that fetches something or can run code (old browsers: `expression()`, `behavior`). */
const UNSAFE_STYLE = /url\(|expression\(|javascript:|@import|behavior\s*:|-moz-binding/i
/** Hidden characters browsers ignore inside a scheme ("java\nscript:"). */
// eslint-disable-next-line no-control-regex
const HIDDEN = /[\u0000- ]/g

purify.addHook('uponSanitizeElement', (node, data) => {
  // The only frame allowed is a YouTube embed from its privacy-friendly host.
  if (data.tagName === 'iframe') {
    const src = (node as Element).getAttribute('src') ?? ''
    if (!YOUTUBE_EMBED.test(src)) node.parentNode?.removeChild(node)
  }
})

purify.addHook('afterSanitizeAttributes', (node) => {
  if (!(node instanceof Element)) return

  const style = node.getAttribute('style')
  if (style !== null && UNSAFE_STYLE.test(style)) node.removeAttribute('style')

  if (node.tagName === 'IMG') {
    // Pictures only from https addresses: no `data:` (can hide SVG), no plain http (mixed content).
    const src = (node.getAttribute('src') ?? '').replace(HIDDEN, '')
    if (!/^https:\/\//i.test(src)) node.removeAttribute('src')
  }

  if (node.tagName === 'A') {
    const href = (node.getAttribute('href') ?? '').replace(HIDDEN, '')
    if (href && !/^(https?:|mailto:|tel:|#|\/(?!\/)|[^a-z:][^:]*$)/i.test(href)) {
      node.removeAttribute('href')
    }
    // A link that opens another tab never gets to reach back to this page.
    if (node.getAttribute('target')) node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Makes untrusted HTML safe to show or to send on: see the file's comment. Returns an HTML string
 * with everything that could run code or load something unwanted taken out; plain text and the
 * allowed tags pass through unchanged. An empty or missing value gives ''.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ['style', 'script', 'form', 'input', 'button', 'select', 'textarea'],
    FORBID_ATTR: ['srcdoc', 'formaction', 'action'],
    // What these hold goes with them (a removed form's "Pay" button label is not left behind as text).
    FORBID_CONTENTS: [
      'applet',
      'button',
      'embed',
      'form',
      'iframe',
      'math',
      'noscript',
      'object',
      'script',
      'select',
      'style',
      'svg',
      'template',
      'textarea',
      'title',
    ],
    // No `javascript:`, `data:`, `vbscript:` — only these schemes (or a relative address).
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    RETURN_TRUSTED_TYPE: false,
  })
}
