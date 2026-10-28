/**
 * Keeps credentials out of URLs. An address ends up in the browser's history, in the address
 * bar (and screenshots of it), in server and proxy logs, in bookmarks and — unless the
 * referrer is cut — in the `Referer` header of whatever the page loads next. A token there is
 * a token everywhere, so **this app never puts one in a URL**: the session token travels only
 * in the `Authorization` header, the sign-in code and Google's ID token in a request body.
 *
 * Three layers keep that true (see "Security" in CLAUDE.md):
 * 1. `scrubAddressBar` — a credential that arrives *in* the address (a pasted link, a redirect
 *    from elsewhere) is removed from the address bar and the history entry before the app starts.
 * 2. `findSensitiveParams` — `lib/api/client.ts` refuses to send a request that would carry one
 *    in its URL.
 * 3. `config/urlTokens.test.ts` fails if source code ever builds one into a URL.
 *
 * There is deliberately no exception: the app has no password-reset link (sign-in is an emailed
 * code or Google), and a flow that did would still not need its token to outlive the first load.
 */

/**
 * Parameter names that carry a credential, compared in lower case without `-` and `_`
 * (so `access_token`, `access-token` and `accessToken` are the same name).
 */
const SENSITIVE = new Set([
  'token',
  'accesstoken',
  'idtoken',
  'refreshtoken',
  'authtoken',
  'sessiontoken',
  'bearer',
  'jwt',
  'authorization',
  'auth',
  'apikey',
  'secret',
  'clientsecret',
  'password',
  'passwd',
  'otp',
  'session',
  'sessionid',
  'sid',
])

const normalise = (name: string) => name.toLowerCase().replace(/[-_]/g, '')

/** Does a parameter of this name carry a credential? */
export function isSensitiveParam(name: string): boolean {
  return SENSITIVE.has(normalise(name))
}

/** A parameter list with the credential-carrying ones taken out (and their names reported). */
function clean(params: URLSearchParams): { kept: URLSearchParams; removed: string[] } {
  const kept = new URLSearchParams()
  const removed: string[] = []
  for (const [name, value] of params) {
    if (isSensitiveParam(name)) removed.push(name)
    else kept.append(name, value)
  }
  return { kept, removed }
}

/**
 * The address without its credential parameters — in the query (`?token=…`) and in the
 * fragment (`#access_token=…`, the form OAuth redirects use, or `#/page?token=…`). Everything
 * else (path, other parameters, their order) is left as it is. `removed` lists the names taken
 * out, empty when the address was already clean.
 */
export function withoutSensitiveParams(href: string): {
  href: string
  removed: string[]
} {
  const url = new URL(href)
  const removed: string[] = []

  const query = clean(url.searchParams)
  if (query.removed.length > 0) {
    removed.push(...query.removed)
    url.search = query.kept.toString()
  }

  const fragment = url.hash.slice(1)
  // `#/page?token=x` keeps its route and cleans its parameters; `#access_token=x&state=y`
  // is all parameters.
  const split = fragment.indexOf('?')
  const route = split === -1 ? '' : fragment.slice(0, split)
  const paramText = split === -1 ? fragment : fragment.slice(split + 1)
  if (paramText.includes('=')) {
    const inFragment = clean(new URLSearchParams(paramText))
    if (inFragment.removed.length > 0) {
      removed.push(...inFragment.removed)
      const rest = inFragment.kept.toString()
      const next = split === -1 ? rest : `${route}${rest ? `?${rest}` : ''}`
      url.hash = next
    }
  }

  return { href: url.toString(), removed }
}

/**
 * Takes any credential out of the page's own address, and out of its history entry (the
 * entry is replaced, not added to, so Back doesn't bring it back). Meant to run once, before
 * the app starts, so nothing the app loads afterwards can see it in the `Referer`. Returns the
 * names removed — empty, and nothing touched, when the address was clean.
 */
export function scrubAddressBar(win: Window = window): string[] {
  const { href, removed } = withoutSensitiveParams(win.location.href)
  if (removed.length === 0) return []
  try {
    const url = new URL(href)
    win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    // The history can be locked down (a sandboxed frame): nothing more can be done.
  }
  return removed
}

/**
 * The credential-carrying parameter names a request would put in its URL: those written in the
 * `path` (`/x?token=…`) and those in its `params` (an object or a `URLSearchParams`).
 */
export function findSensitiveParams(path: string, params?: unknown): string[] {
  const names: string[] = []
  const query = path.indexOf('?')
  if (query !== -1)
    names.push(...new URLSearchParams(path.slice(query + 1).split('#')[0]).keys())
  if (params instanceof URLSearchParams) names.push(...params.keys())
  else if (typeof params === 'object' && params !== null)
    names.push(...Object.keys(params))
  return names.filter(isSensitiveParam)
}
