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
    callback: (response: { credential: string }) => void
  }): void
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } }
  }
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
