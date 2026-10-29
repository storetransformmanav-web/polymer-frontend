import type { ReactNode } from 'react'
import { Switch } from '../../../components/ui/Switch.tsx'
import type { LockOptions } from '../utils/lockDraft.ts'
import { LockCard } from './LockCard.tsx'

interface OptionCardProps {
  options: LockOptions
  onChange: (patch: Partial<LockOptions>) => void
  disabled?: boolean
}

function Check({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-accent mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
      />
      <span className="flex flex-col">
        <span className="text-[0.88rem] font-semibold">{label}</span>
        <span className="text-text-muted text-[0.78rem] leading-snug">{hint}</span>
      </span>
    </label>
  )
}

/** "Enable this lock" and what guests without a key do not see. */
export function LockSettingsCard({ options, onChange, disabled }: OptionCardProps) {
  return (
    <LockCard title="Settings">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Switch
            label="Enable this lock"
            checked={options.enabled}
            disabled={disabled}
            onChange={(enabled) => onChange({ enabled })}
          />
          <span className="text-text-muted text-[0.78rem]">
            Switched off, the lock keeps its tags and settings but everyone can see the
            product.
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-[0.82rem] font-semibold">For guests without a key…</p>
          <Check
            label="Hide from navigation menus"
            hint="Applies when links to this product appear in navigation menus."
            checked={options.hideFromNav}
            disabled={disabled}
            onChange={(hideFromNav) => onChange({ hideFromNav })}
          />
          <Check
            label="Hide from lists"
            hint="Applies when the product appears in search results, collection pages and other lists."
            checked={options.hideFromLists}
            disabled={disabled}
            onChange={(hideFromLists) => onChange({ hideFromLists })}
          />
        </div>
      </div>
    </LockCard>
  )
}

/** The less common switches. */
export function LockAdvancedCard({ options, onChange, disabled }: OptionCardProps) {
  return (
    <LockCard title="Advanced settings">
      <div className="flex flex-col gap-3">
        <Check
          label="Enable manual locking"
          hint="Turns off the app’s own protection for this lock, so the theme developer enforces it in Liquid code."
          checked={options.manualLocking}
          disabled={disabled}
          onChange={(manualLocking) => onChange({ manualLocking })}
        />
        <Check
          label="Hide product from sitemaps"
          hint="Keeps the product out of the sitemap, so search engines do not list it."
          checked={options.hideFromSitemap}
          disabled={disabled}
          onChange={(hideFromSitemap) => onChange({ hideFromSitemap })}
        />
        <Check
          label="Ask search engines not to index it"
          hint="Adds a noindex tag to the product page."
          checked={options.noindex}
          disabled={disabled}
          onChange={(noindex) => onChange({ noindex })}
        />
      </div>
    </LockCard>
  )
}

/** What a shopper without access reads. */
export function LockMessageCard({ options, onChange, disabled }: OptionCardProps) {
  return (
    <LockCard
      title="Message"
      description="Shown to a customer who does not have access. Leave it empty to use the store’s default."
    >
      <textarea
        aria-label="Access denied message"
        value={options.message}
        disabled={disabled}
        rows={4}
        maxLength={2000}
        placeholder="This product is for approved trade accounts. Please log in to continue."
        onChange={(event) => onChange({ message: event.target.value })}
        className="border-border bg-surface text-text placeholder:text-text-muted focus:border-accent focus:outline-accent-tint w-full resize-y rounded-lg border px-3 py-2 text-[0.88rem] outline-none focus:outline-2"
      />
    </LockCard>
  )
}
