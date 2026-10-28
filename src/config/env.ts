/**
 * Single point of access for environment/config values. Never read
 * `import.meta.env` directly from feature code — go through this file
 * so every consumer gets the same validation, defaults and types, and
 * so a missing variable fails fast and loudly instead of surfacing as
 * `undefined` deep inside a component.
 *
 * Only variables prefixed with `VITE_` are exposed by Vite to client
 * code — see https://vite.dev/guide/env-and-mode.html. Declare new
 * ones in src/vite-env.d.ts too, so they're typed here.
 */

function requireEnv(key: keyof ImportMetaEnv, fallback?: string): string {
  const value = import.meta.env[key] ?? fallback
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

/** A `true` / `false` setting: anything else (unset, empty, "yes"…) is the `fallback`. */
export function readFlag(value: string | undefined, fallback: boolean): boolean {
  const text = value?.trim().toLowerCase()
  if (text === 'true') return true
  if (text === 'false') return false
  return fallback
}

export const env = {
  apiBaseUrl: requireEnv('VITE_API_BASE_URL', '/api'),
  /**
   * Turn off the right-click menu and the shortcuts that open the browser's developer tools
   * (`lib/devToolsGuard.ts`). On in production builds, off in `npm run dev` (developers need
   * their tools) unless `VITE_BLOCK_DEVTOOLS` says otherwise.
   */
  blockDevTools: readFlag(import.meta.env.VITE_BLOCK_DEVTOOLS, import.meta.env.PROD),
  /** OAuth client ID for Google sign-in; empty hides the Google button. */
  googleClientId: requireEnv('VITE_GOOGLE_CLIENT_ID', ''),
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}
