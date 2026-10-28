/// <reference types="node" />
// (This test reads source files from disk, so it needs Node's types; the
// browser code in src/ deliberately doesn't.)
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards "no credential in a URL" (see lib/urlSecurity.ts). A URL is logged, kept in the
 * browser's history and handed on in the `Referer`, so the session token travels only in the
 * `Authorization` header and other secrets only in a request body. The runtime layers —
 * `scrubAddressBar` and the check in `apiClient` — catch it when it happens; this catches the
 * code that would make it happen.
 */

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const isTest = (path: string) =>
  /\.test\.tsx?$/.test(path) || path.includes(`${sep}test${sep}`)
const rel = (path: string) => relative(ROOT, path).split(sep).join('/')

// urlSecurity.ts names the credentials in order to catch them, so it is the one file allowed to.
const productionFiles = sourceFiles(SRC).filter(
  (path) => !isTest(path) && rel(path) !== 'src/lib/urlSecurity.ts',
)

/** A file's lines of code: comments may talk about `?token=…`, code may not build it. */
const codeLines = (path: string) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))

const CREDENTIAL =
  'access_?token|id_?token|refresh_?token|auth_?token|session_?token|token|jwt|bearer|api_?key|client_?secret|secret|password|passwd|otp|session_?id|sid'

describe('no credential in a URL', () => {
  it('writes no URL with a credential in its query or fragment (?token=…, &access_token=…, #id_token=…)', () => {
    const written = new RegExp(`[?&#](?:${CREDENTIAL})=`, 'i')
    const offenders = productionFiles.filter((path) =>
      codeLines(path).some((line) => written.test(line)),
    )

    expect(offenders.map(rel)).toEqual([])
  })

  it('builds no query parameters from a credential (params: { token }, searchParams.set("token", …))', () => {
    const built = new RegExp(
      `\\b(?:params|searchParams|URLSearchParams)\\b[^;\\n]{0,80}['"\`\\s{,:](?:${CREDENTIAL})['"\`\\s},:]`,
      'i',
    )
    const offenders = productionFiles.filter((path) =>
      codeLines(path).some((line) => built.test(line)),
    )

    expect(offenders.map(rel)).toEqual([])
  })

  it('has the scan itself working: it would catch each pattern it guards against', () => {
    const written = new RegExp(`[?&#](?:${CREDENTIAL})=`, 'i')
    expect(written.test('`/x?token=${t}`')).toBe(true)
    expect(written.test("'/x?a=1&access_token=' + t")).toBe(true)
    expect(written.test('/cb#id_token=')).toBe(true)
    expect(written.test('/x?page=2&tag=eco')).toBe(false)
  })

  it('removes a credential from the address before the app starts', () => {
    const main = readFileSync(join(SRC, 'main.tsx'), 'utf8')

    expect(main).toContain('scrubAddressBar()')
    expect(main.indexOf('scrubAddressBar()')).toBeLessThan(main.indexOf('createRoot('))
  })

  it('refuses credentials in a request URL in the one place every request goes through', () => {
    const client = readFileSync(join(SRC, 'lib', 'api', 'client.ts'), 'utf8')

    expect(client).toContain('findSensitiveParams(')
    expect(client).toContain('ERR_CREDENTIAL_IN_URL')
  })

  it('sends the session token only as an Authorization header', () => {
    const uses = productionFiles
      .filter((path) => /Bearer\s*\$\{/.test(readFileSync(path, 'utf8')))
      .map(rel)

    // Both put it in a header: the interceptor, and logout (which carries the token it revokes).
    expect(uses.sort()).toEqual(['src/lib/api/client.ts', 'src/lib/api/endpoints.ts'])
  })
})
