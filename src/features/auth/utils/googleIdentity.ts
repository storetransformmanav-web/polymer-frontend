/**
 * Minimal typed wrapper around Google Identity Services (GIS), loaded
 * straight from Google rather than through an npm package. Only the
 * slice of the API this app uses is typed.
 * https://developers.google.com/identity/gsi/web/reference/js-reference
 */

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill'
  logo_alignment?: 'left' | 'center'
  /** Pixels, 200–400. */
  width?: number
}

export interface GoogleIdentity {
  initialize(config: {
    client_id: string
    /** Put into the ID token Google issues; the backend checks it is the one this sign-in made. */
    nonce?: string
    callback: (response: { credential: string }) => void
  }): void
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } }
  }
}

/**
 * A new random value for one Google sign-in: 24 bytes from the browser's secure random generator,
 * written in base64url (32 characters of A–Z a–z 0–9 - _, inside the API's 8–256). It is given to
 * Google (`initialize({ nonce })`, which puts it in the ID token) and sent to the API as `nonce`,
 * which refuses a token whose nonce is not the one sent with it. Make a new one for every sign-in,
 * never reuse one.
 */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

let loading: Promise<GoogleIdentity> | null = null

/**
 * Loads the GIS script once and resolves with its `accounts.id` API.
 * A failed load (offline, blocked by an extension) isn't cached, so the
 * next call can retry.
 */
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const existing = window.google?.accounts?.id
  if (existing) return Promise.resolve(existing)

  loading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.onload = () => {
      const gis = window.google?.accounts?.id
      if (gis) resolve(gis)
      else reject(new Error('Google Identity Services failed to initialise'))
    }
    script.onerror = () => {
      script.remove()
      reject(new Error('Google Identity Services failed to load'))
    }
    document.head.append(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })

  return loading
}
