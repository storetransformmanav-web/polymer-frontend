import { useId, useState } from 'react'
import { RefreshIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { useSyncOneProduct } from '../hooks/useSyncOneProduct.ts'

/** A Shopify product ID is typed in a box that takes at most this many characters. */
const SHOPIFY_ID_MAX = 30

/** Why a typed Shopify product ID can't be sent, or null when it can. */
function shopifyIdProblem(text: string): string | null {
  const id = text.trim()
  if (!id) return 'Enter the product’s Shopify ID.'
  if (id.length > SHOPIFY_ID_MAX) return `At most ${SHOPIFY_ID_MAX} characters.`
  if (!/^\d+$/.test(id)) return 'Digits only, e.g. 15497136308609.'
  return null
}

interface SyncTarget {
  key: string
  label: string
}

const HEADING = 'text-text-muted text-[0.68rem] font-bold tracking-wide uppercase'
const SMALL_BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3 text-[0.8rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60'

/**
 * What "Sync products" drops down: a small panel under the button. On top, **one product** — a
 * box for its Shopify product ID (digits, at most 30 characters) with a **Sync** button beside it
 * (Enter works too), the store when "All shops" is selected, and an **Only compare** box
 * (`dry_run`: differences only, nothing saved). Below a line, **Sync all products** — the
 * background sync of every product of the stores in play. Either one closes the panel once it
 * has started (a single product once the backend has answered — its result shows beside the
 * button); a refused single product keeps the panel open with the backend's message.
 */
export function SyncProductsPanel({
  targets,
  one,
  canSyncAll,
  onSyncAll,
  onClose,
}: {
  /** The stores in play: the one picked in the top bar, or every connected one. */
  targets: SyncTarget[]
  /** The single-product sync, held by the button so its result outlives the panel. */
  one: ReturnType<typeof useSyncOneProduct>
  canSyncAll: boolean
  onSyncAll: () => void
  onClose: () => void
}) {
  const ids = useId()
  const [shopifyId, setShopifyId] = useState('')
  const [shop, setShop] = useState(targets[0]?.key ?? '')
  const [dryRun, setDryRun] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const names = targets.map((target) => target.label).join(', ')

  function syncOne() {
    const wrong = shopifyIdProblem(shopifyId)
    setProblem(wrong)
    if (wrong || !shop || one.isSyncing) return
    one.sync({ shopifyId: shopifyId.trim(), shop, dryRun }, { onSuccess: onClose })
  }

  const message = problem ?? one.error

  return (
    <div
      role="group"
      aria-label="Sync products"
      className="border-border bg-bg absolute top-full right-0 z-30 mt-1.5 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-xl border p-3 shadow-lg"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          syncOne()
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={`${ids}-id`} className={HEADING}>
          One product · Shopify ID
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`${ids}-id`}
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 15497136308609"
            maxLength={SHOPIFY_ID_MAX}
            value={shopifyId}
            aria-invalid={message ? true : undefined}
            onChange={(event) => {
              setShopifyId(event.target.value)
              setProblem(null)
              one.reset()
            }}
            className="border-border bg-bg text-text placeholder:text-text-muted focus:border-accent focus:outline-accent-tint aria-[invalid=true]:border-danger h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-[0.84rem] outline-none focus:outline-2"
          />
          <button
            type="submit"
            disabled={one.isSyncing}
            className={`${SMALL_BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover`}
          >
            {one.isSyncing && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            {dryRun ? 'Compare' : 'Sync'}
          </button>
        </div>

        {targets.length > 1 && (
          <label className="text-text-muted flex items-center gap-2 text-[0.76rem]">
            Store
            <select
              value={shop}
              onChange={(event) => {
                setShop(event.target.value)
                one.reset()
              }}
              className="border-border bg-bg text-text focus:border-accent h-8 min-w-0 flex-1 cursor-pointer rounded-md border px-2 text-[0.8rem] outline-none"
            >
              {targets.map((target) => (
                <option key={target.key} value={target.key}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-[0.8rem]">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => {
              setDryRun(event.target.checked)
              one.reset()
            }}
            className="accent-accent h-4 w-4 shrink-0 cursor-pointer"
          />
          Only compare
          <span className="text-text-muted text-[0.74rem]">(nothing is saved)</span>
        </label>

        <span className="text-text-muted flex justify-between text-[0.7rem]">
          <span>Digits only</span>
          <span aria-live="polite">
            {shopifyId.length}/{SHOPIFY_ID_MAX}
          </span>
        </span>
        {message && (
          <p role="alert" className="text-danger m-0 text-[0.76rem]">
            {message}
          </p>
        )}
      </form>

      <div className="border-border flex flex-col gap-1.5 border-t pt-2.5">
        <button
          type="button"
          disabled={!canSyncAll}
          onClick={() => {
            onSyncAll()
            onClose()
          }}
          className={`${SMALL_BUTTON} border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint w-full border border-solid`}
        >
          <RefreshIcon width={14} height={14} />
          Sync all products
        </button>
        <span className="text-text-muted text-center text-[0.7rem]">
          Every product of {names || 'the store'}, in the background.
        </span>
      </div>
    </div>
  )
}
