import logoSrc from '../../assets/logo.avif'
import './Logo.css'

/**
 * The Polymer brand mark. The image itself already contains the
 * wordmark ("Packaging by Polymer"), so this never renders extra text
 * next to it — just the image, scaled to fit its container.
 */
export function Logo({ className = '' }) {
  return <img src={logoSrc} alt="Polymer" className={`logo ${className}`.trim()} />
}
