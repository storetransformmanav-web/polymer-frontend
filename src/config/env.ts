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

export const env = {
  apiBaseUrl: requireEnv('VITE_API_BASE_URL', '/api'),
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}
