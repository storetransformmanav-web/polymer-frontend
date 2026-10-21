import { createElement, Fragment, type ReactNode } from 'react'

/**
 * Shows a piece of HTML (a product description from the store) with its structure —
 * paragraphs, bold, lists, tables, headings, links — without ever putting that HTML
 * on the page as markup. The text is parsed into an inert document (nothing runs,
 * nothing loads) and rebuilt as React elements from a short list of allowed tags:
 *
 *  - scripts, styles, frames, images, forms and anything else not listed are dropped
 *    (with everything inside them);
 *  - an unknown but harmless tag (`<font>`, `<section>`…) is replaced by its content;
 *  - no attribute is copied, except a link's address (only http/https, always opened
 *    safely) and a table cell's span.
 */

const BLOCK_CLASS: Record<string, string> = {
  p: 'my-1.5',
  div: '',
  h1: 'mt-3 mb-1.5 text-[1.15rem] font-semibold',
  h2: 'mt-3 mb-1.5 text-[1.05rem] font-semibold',
  h3: 'mt-3 mb-1.5 text-[0.98rem] font-semibold',
  h4: 'mt-2 mb-1 font-semibold',
  h5: 'mt-2 mb-1 font-semibold',
  h6: 'mt-2 mb-1 font-semibold',
  ul: 'my-2 list-disc pl-5',
  ol: 'my-2 list-decimal pl-5',
  li: 'my-0.5',
  blockquote: 'border-border my-2 border-l-2 pl-3',
  table: 'my-2 border-collapse text-[0.85rem]',
  thead: '',
  tbody: '',
  tfoot: '',
  tr: '',
  th: 'border-border border px-3 py-1.5 text-left align-top font-semibold',
  td: 'border-border border px-3 py-1.5 text-left align-top',
  figure: 'my-2 overflow-x-auto',
  strong: 'font-semibold',
  b: 'font-semibold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  s: 'line-through',
  sub: '',
  sup: '',
  small: 'text-[0.85em]',
  span: '',
}

/** Removed together with their content. */
const DROPPED = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'img',
  'picture',
  'video',
  'audio',
  'source',
  'svg',
  'math',
  'canvas',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'link',
  'meta',
  'base',
  'head',
  'title',
])

const SPAN_ATTRIBUTES = ['colspan', 'rowspan'] as const

function safeHref(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function convert(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const element = node as Element
  const tag = element.tagName.toLowerCase()
  if (DROPPED.has(tag)) return null

  const children = Array.from(element.childNodes).map((child, index) =>
    convert(child, `${key}.${index}`),
  )

  if (tag === 'br') return <br key={key} />
  // An "empty" paragraph (just a non-breaking space) is how editors make a gap: keep it small.
  if (
    tag === 'p' &&
    element.children.length === 0 &&
    (element.textContent ?? '').replace(/[\s\u00a0]/g, '') === ''
  ) {
    return <p key={key} aria-hidden="true" className="h-2" />
  }
  if (tag === 'hr') return <hr key={key} className="border-border my-3" />

  if (tag === 'a') {
    const href = safeHref(element.getAttribute('href'))
    return href ? (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline underline-offset-2"
      >
        {children}
      </a>
    ) : (
      <Fragment key={key}>{children}</Fragment>
    )
  }

  if (!(tag in BLOCK_CLASS)) return <Fragment key={key}>{children}</Fragment>

  const props: Record<string, unknown> = { key }
  const className = BLOCK_CLASS[tag]
  if (className) props.className = className
  if (tag === 'td' || tag === 'th') {
    for (const name of SPAN_ATTRIBUTES) {
      const value = Number(element.getAttribute(name))
      if (Number.isInteger(value) && value > 1 && value <= 50) {
        props[name === 'colspan' ? 'colSpan' : 'rowSpan'] = value
      }
    }
  }
  return createElement(tag, props, ...children)
}

export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (
    <div className={className}>
      {Array.from(doc.body.childNodes).map((node, index) => convert(node, String(index)))}
    </div>
  )
}
