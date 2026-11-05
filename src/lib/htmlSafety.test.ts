import { describe, expect, it } from 'vitest'
import { hasUnsafeHtml } from './htmlSafety.ts'

describe('hasUnsafeHtml', () => {
  it.each([
    '<p>Plain</p>',
    'Just words, with no tags',
    '<h2 class="x" style="color: red">Title</h2><ul><li><strong>One</strong></li></ul>',
    '<a href="https://example.com">site</a> <a href="mailto:a@b.co">mail</a> <a href="/x">here</a>',
    '<img src="https://cdn.shopify.com/a.jpg" alt="Bag">',
    '<table><tr><td colspan="2">Cell</td></tr></table>',
    '<div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe></div>',
    '<p>on sale: 5 &lt;script&gt; written out as text</p>',
    '',
  ])('leaves safe HTML alone: %s', (html) => {
    expect(hasUnsafeHtml(html)).toBe(false)
  })

  it.each([
    '<script>alert(1)</script>',
    '<p>Hi</p><SCRIPT SRC="https://evil.example/x.js"></SCRIPT>',
    '<img src="x" onerror="alert(1)">',
    '<p ONCLICK="alert(1)">Hi</p>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href=" java\nscript:alert(1)">x</a>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<object data="x.swf"></object>',
    '<embed src="x.swf">',
    '<svg onload="alert(1)"></svg>',
    '<math><mi href="javascript:alert(1)"></mi></math>',
    '<form action="https://evil.example"><input name="card"></form>',
    '<base href="https://evil.example/">',
    '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    '<link rel="stylesheet" href="https://evil.example/a.css">',
    '<style>body { display: none }</style>',
    '<p style="background: url(https://evil.example/track.png)">Hi</p>',
    '<template><script>alert(1)</script></template>',
  ])('finds unsafe HTML: %s', (html) => {
    expect(hasUnsafeHtml(html)).toBe(true)
  })

  it('never runs what it checks', () => {
    const win = window as unknown as { hacked?: boolean }
    hasUnsafeHtml(
      '<img src="x" onerror="window.hacked = true"><script>window.hacked = true</script>',
    )
    expect(win.hacked).toBeUndefined()
  })
})
