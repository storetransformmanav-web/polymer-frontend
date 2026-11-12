import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml.ts'

/** Parses the cleaned HTML the way a browser would, so the checks look at real elements. */
function parse(html: string) {
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html')
  return doc.body
}

describe('sanitizeHtml', () => {
  it('leaves what the editor makes as it is', () => {
    const html =
      '<h2>Title</h2><p>Some <strong>bold</strong>, <em>italic</em> and <u>underlined</u> text.</p>' +
      '<ul><li>One</li><li>Two</li></ul>' +
      '<table><tbody><tr><td colspan="2">Cell</td></tr></tbody></table>'
    const body = parse(html)

    expect(body.querySelector('h2')?.textContent).toBe('Title')
    expect(body.querySelector('strong')?.textContent).toBe('bold')
    expect(body.querySelectorAll('li')).toHaveLength(2)
    expect(body.querySelector('td')?.getAttribute('colspan')).toBe('2')
  })

  it('gives nothing for an empty or missing value', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })

  it('removes scripts, with what is inside them', () => {
    const body = parse('<p>Hi</p><script>alert(1)</script>')
    expect(body.querySelector('script')).toBeNull()
    expect(body.textContent).toBe('Hi')
  })

  it('removes event handlers from any element', () => {
    const body = parse(
      '<p onclick="alert(1)" onmouseover="x()">A</p><img src="https://a.test/x.png" onerror="alert(1)">',
    )
    for (const element of body.querySelectorAll('*')) {
      expect(
        Array.from(element.attributes).some((attribute) =>
          attribute.name.startsWith('on'),
        ),
      ).toBe(false)
    }
  })

  it('removes javascript: and data: addresses from links, whatever hidden characters they hide behind', () => {
    for (const href of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'java\nscript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ]) {
      const link = parse(`<a href="${href}">x</a>`).querySelector('a')
      expect(link?.getAttribute('href'), href).toBeNull()
    }
  })

  it('keeps http, https, mailto and tel links, and makes a new-tab link safe', () => {
    const body = parse(
      '<a href="https://example.com">a</a><a href="mailto:a@b.co">b</a><a href="tel:+441234">c</a>' +
        '<a href="https://example.com" target="_blank">d</a>',
    )
    const links = Array.from(body.querySelectorAll('a'))
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://example.com',
      'mailto:a@b.co',
      'tel:+441234',
      'https://example.com',
    ])
    expect(links[3].getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('removes SVG, MathML, forms, stylesheets and other things that run or collect', () => {
    const body = parse(
      '<svg onload="alert(1)"><circle/></svg><math><mi xlink:href="javascript:alert(1)">x</mi></math>' +
        '<form action="https://evil.test"><input name="card"><button>Pay</button></form>' +
        '<style>body{display:none}</style><object data="x"></object><embed src="x"><base href="https://evil.test">',
    )
    for (const tag of [
      'svg',
      'math',
      'form',
      'input',
      'button',
      'style',
      'object',
      'embed',
      'base',
    ]) {
      expect(body.querySelector(tag), tag).toBeNull()
    }
  })

  it('allows a picture only from an https address', () => {
    const body = parse(
      '<img src="https://cdn.example.com/a.png" alt="ok"><img src="data:image/svg+xml,<svg onload=alert(1)>">' +
        '<img src="http://plain.example.com/a.png"><img src="javascript:alert(1)">',
    )
    const sources = Array.from(body.querySelectorAll('img')).map((img) =>
      img.getAttribute('src'),
    )
    expect(sources).toEqual(['https://cdn.example.com/a.png', null, null, null])
  })

  it('allows a frame only for a YouTube embed from youtube-nocookie.com', () => {
    const body = parse(
      '<div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/abc123" allowfullscreen></iframe></div>' +
        '<iframe src="https://evil.test/"></iframe><iframe src="https://www.youtube.com/embed/abc"></iframe>' +
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    )
    const frames = Array.from(body.querySelectorAll('iframe'))
    expect(frames).toHaveLength(1)
    expect(frames[0].getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123',
    )
    expect(body.querySelector('[data-youtube-video]')).not.toBeNull()
  })

  it('drops a style that fetches or runs something, and keeps a harmless one', () => {
    const body = parse(
      '<p style="color: #aa0000; text-align: center">ok</p>' +
        '<p style="background: url(https://evil.test/x)">bad</p><p style="width: expression(alert(1))">bad</p>',
    )
    const [ok, bad1, bad2] = Array.from(body.querySelectorAll('p'))
    expect(ok.getAttribute('style')).toContain('color')
    expect(bad1.getAttribute('style')).toBeNull()
    expect(bad2.getAttribute('style')).toBeNull()
  })

  it('survives mutation-XSS and nesting tricks', () => {
    const payloads = [
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>',
      '<svg><p><style><img src="</style><img src=x onerror=alert(1)//">',
      '<a href="javascript&colon;alert(1)">x</a>',
      '<img src=x onerror=alert(1)//',
      '<scr<script>ipt>alert(1)</scr</script>ipt>',
    ]
    for (const payload of payloads) {
      const cleaned = sanitizeHtml(payload)
      expect(cleaned, payload).not.toMatch(
        /onerror|onload|javascript:|<script|<svg|<style/i,
      )
    }
  })
})
