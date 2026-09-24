import logoSrc from '../../assets/logo.avif'
import './Logo.css'

/**
 * The Polymer brand mark. `mark` renders the logo image alone (used in
 * the collapsed sidebar); the default renders the image plus a text
 * lockup.
 */
export function Logo({ variant = 'full', className = '' }) {
  if (variant === 'mark') {
    return (
      <img
        src={logoSrc}
        alt="Polymer"
        className={`logo logo--mark ${className}`.trim()}
      />
    )
  }

  return (
    <span className={`logo ${className}`.trim()}>
      <img src={logoSrc} alt="" className="logo__mark" />
      <span className="logo__text">
        Polymer <span className="logo__text-accent">CRM</span>
      </span>
    </span>
  )
}
