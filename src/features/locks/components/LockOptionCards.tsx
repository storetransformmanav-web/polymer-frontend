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

/** "Enable this lock" and what guests without a key do not see — the fields, without a card around them. */
export function SettingsFields({ options, onChange, disabled }: OptionCardProps) {
  return (
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
          hint={
            <>
              Applies when this product appears in:
              <span role="list" className="mt-1 flex flex-col gap-0.5">
                {['Search results', 'Collection pages', 'And other areas...'].map(
                  (area) => (
                    <span
                      key={area}
                      role="listitem"
                      className="flex gap-2 before:content-['•']"
                    >
                      {area}
                    </span>
                  ),
                )}
              </span>
            </>
          }
          checked={options.hideFromLists}
          disabled={disabled}
          onChange={(hideFromLists) => onChange({ hideFromLists })}
        />
      </div>
    </div>
  )
}

/** The less common switches — the fields only. */
export function AdvancedFields({ options, onChange, disabled }: OptionCardProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* <Check
        label="Enable manual locking"
        hint="Disables Lock management's protection for this lock, allowing you to enforce the lock yourself using custom Liquid code."
        checked={options.manualLocking}
        disabled={disabled}
        onChange={(manualLocking) => onChange({ manualLocking })}
      /> */}
      <Check
        label="Hide product from sitemaps"
        hint="Adds the SEO:Hidden metafield to this product, which results in hiding it from sitemaps, preventing Shopify from sending it to search engines, and removing it from storefront search results."
        checked={options.hideFromSitemap}
        disabled={disabled}
        onChange={(hideFromSitemap) => onChange({ hideFromSitemap })}
      />
      <Check
        label="Add the “noindex” meta tag to any pages protected by this lock"
        hint="When enabled, adds the “noindex” meta tag whenever this lock denies access to the visitor."
        checked={options.noindex}
        disabled={disabled}
        onChange={(noindex) => onChange({ noindex })}
      />
    </div>
  )
}

/** The access-denied message box. */
export function MessageField({ options, onChange, disabled }: OptionCardProps) {
  return (
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
  )
}

/** The Add lock form's cards: the same fields inside a plain card. */
export function LockSettingsCard(props: OptionCardProps) {
  return (
    <LockCard title="Settings">
      <SettingsFields {...props} />
    </LockCard>
  )
}

export function LockAdvancedCard(props: OptionCardProps) {
  return (
    <LockCard title="Advanced settings">
      <AdvancedFields {...props} />
    </LockCard>
  )
}

export function LockMessageCard(props: OptionCardProps) {
  return (
    <LockCard
      title="Message"
      description="Shown to a customer who does not have access. Leave it empty to use the store’s default."
    >
      <MessageField {...props} />
    </LockCard>
  )
}
