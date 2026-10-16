/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Locks in the security headers deployed by vercel.json, so a well-meant
 * edit (say, adding 'unsafe-inline' to make something work) can't quietly
 * remove the protection. Verified end to end in a real browser when added.
 */

interface HeaderRule {
  source: string
  headers: { key: string; value: string }[]
}

const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
  headers: HeaderRule[]
  rewrites: { source: string; destination: string }[]
}

function headersFor(source: string): Record<string, string> {
  const rule = config.headers.find((header) => header.source === source)
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]))
}

/** Parses a CSP header into { directive: [sources…] }. */
function parseCsp(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/)
        return [name, sources]
      }),
  )
}

const everyPage = headersFor('/(.*)')
const csp = parseCsp(everyPage['Content-Security-Policy'] ?? '')

describe('vercel.json security headers', () => {
  it('sends the standard hardening headers on every page', () => {
    expect(everyPage['X-Content-Type-Options']).toBe('nosniff')
    expect(everyPage['X-Frame-Options']).toBe('DENY')
    expect(everyPage['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(everyPage['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/)
    expect(everyPage['Permissions-Policy']).toContain('camera=()')
    expect(everyPage['Permissions-Policy']).toContain('microphone=()')
    expect(everyPage['Permissions-Policy']).toContain('geolocation=()')
  })

  it('never lets scripts run inline or via eval — the core XSS protection', () => {
    const scriptSources = csp['script-src'] ?? []

    expect(scriptSources).toContain("'self'")
    expect(scriptSources).not.toContain("'unsafe-inline'")
    expect(scriptSources).not.toContain("'unsafe-eval'")
    expect(scriptSources).not.toContain('*')
    expect(scriptSources).not.toContain('https:')
    // The only third-party script is Google's sign-in, pinned to its exact path.
    expect(scriptSources.filter((source) => source !== "'self'")).toEqual([
      'https://accounts.google.com/gsi/client',
    ])
  })

  it('denies everything by default and blocks plugins, framing and base-tag hijacking', () => {
    expect(csp['default-src']).toEqual(["'self'"])
    expect(csp['object-src']).toEqual(["'none'"])
    expect(csp['frame-ancestors']).toEqual(["'none'"])
    expect(csp['base-uri']).toEqual(["'self'"])
    expect(csp['form-action']).toEqual(["'self'"])
  })

  it('only allows the API calls and frames the app really needs', () => {
    // Own site (the /api proxy), the backend (for direct calls when
    // VITE_API_BASE_URL is the full backend URL), and Google sign-in — nothing else,
    // so injected code can't send data to an attacker's server. Frames: Google sign-in,
    // and YouTube's privacy-friendly player for videos in the description editor.
    expect(csp['connect-src']).toEqual([
      "'self'",
      'https://polymeruk-api.vercel.app',
      'https://accounts.google.com/gsi/',
    ])
    expect(csp['frame-src']).toEqual([
      'https://accounts.google.com/gsi/',
      'https://www.youtube-nocookie.com',
    ])
  })

  it('allows inline styles only because Google’s sign-in button needs them (never scripts)', () => {
    expect(csp['style-src-attr']).toEqual(["'unsafe-inline'"])
    expect(csp['style-src-elem']).toContain("'unsafe-inline'")
    expect(csp['style-src']).not.toContain("'unsafe-inline'")
  })

  it('does not allow inline scripts in the HTML shell (theme init is an external file)', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    const inlineScripts = [
      ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g),
    ].filter(([, attributes, body]) => !/\bsrc=/.test(attributes) && body.trim() !== '')

    expect(inlineScripts).toHaveLength(0)
  })

  it('keeps API responses out of shared caches', () => {
    expect(headersFor('/api/(.*)')['Cache-Control']).toBe('no-store')
  })

  it('forwards /api to the backend before the single-page-app fallback', () => {
    const sources = config.rewrites.map((rewrite) => rewrite.source)

    expect(sources.indexOf('/api/:path*')).toBeGreaterThanOrEqual(0)
    expect(sources.indexOf('/api/:path*')).toBeLessThan(sources.indexOf('/(.*)'))
  })
})
