/**
 * The picture at the foot of the export dialog's side panel: a spreadsheet page with a
 * round download button, on a soft cloud. Decorative; coloured from the theme.
 */
export function ExportIllustration() {
  return (
    <svg
      viewBox="0 0 220 130"
      role="presentation"
      aria-hidden="true"
      className="mx-auto h-auto w-full max-w-[13.5rem]"
    >
      {/* cloud */}
      <ellipse
        cx="110"
        cy="100"
        rx="88"
        ry="22"
        className="fill-accent-tint"
        opacity="0.7"
      />
      <circle cx="70" cy="82" r="26" className="fill-accent-tint" opacity="0.8" />
      <circle cx="150" cy="84" r="24" className="fill-accent-tint" opacity="0.8" />
      <circle cx="112" cy="72" r="34" className="fill-accent-tint" />
      {/* the page behind */}
      <rect
        x="54"
        y="52"
        width="36"
        height="46"
        rx="5"
        className="fill-bg stroke-border"
        strokeWidth="1.5"
        transform="rotate(-9 72 75)"
      />
      <path
        d="M61 66h20M61 74h20M61 82h14"
        className="stroke-border"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-9 72 75)"
      />
      {/* the spreadsheet in front */}
      <rect
        x="82"
        y="30"
        width="64"
        height="70"
        rx="7"
        className="fill-bg stroke-border"
        strokeWidth="1.5"
      />
      <rect
        x="90"
        y="40"
        width="24"
        height="5"
        rx="2.5"
        className="fill-accent"
        opacity="0.55"
      />
      <rect x="90" y="52" width="48" height="9" rx="2" className="fill-accent-tint" />
      <rect
        x="90"
        y="64"
        width="48"
        height="9"
        rx="2"
        className="fill-accent"
        opacity="0.4"
      />
      <rect x="90" y="76" width="48" height="9" rx="2" className="fill-accent-tint" />
      <path d="M106 52v33M122 52v33" className="stroke-bg" strokeWidth="2" />
      {/* the download button */}
      <circle cx="146" cy="92" r="16" className="fill-accent" />
      <path
        d="M146 84v13m0 0-6-6m6 6 6-6"
        fill="none"
        stroke="var(--color-accent-contrast)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* sparkles */}
      <circle cx="36" cy="58" r="3" className="fill-accent" opacity="0.45" />
      <circle cx="186" cy="48" r="2.5" className="fill-accent" opacity="0.35" />
      <circle cx="174" cy="112" r="2" className="fill-accent" opacity="0.4" />
    </svg>
  )
}
