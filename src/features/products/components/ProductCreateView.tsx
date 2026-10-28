import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { ArrowLeftIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import type { SelectOption } from '../../../components/ui/SelectField.tsx'
import { useShops } from '../../../hooks/useShops.ts'
import type { ProductCreateResult } from '../../../lib/api/endpoints.ts'
import { useCreateProduct } from '../hooks/useCreateProduct.ts'
import { useStockLocations } from '../hooks/useStockLocations.ts'
import type { PickedFile } from '../utils/mediaFiles.ts'
import {
  blankCreateDraft,
  firstImageUrl,
  isCreateDirty,
  syncVariants,
  validateCreateDraft,
  type CreateDraft,
} from '../utils/createDraft.ts'
import { CreateBasicsCard } from './create/CreateBasicsCard.tsx'
import { CreateMetafieldsCard, CreateSeoCard } from './create/CreateListingCards.tsx'
import {
  CreateInventoryCard,
  CreatePriceCard,
  CreateShippingCard,
} from './create/CreatePricingCards.tsx'
import { CreateOrganizationCards } from './create/CreateSidebarCards.tsx'
import { CreateVariantsCard } from './create/CreateVariantsCard.tsx'

interface ProductCreateViewProps {
  onBack: () => void
  /** Tells the page whether the form holds anything typed (its tab asks before closing). */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * The product exists (it is already in the cached list). `previewUrl` is the
   * image address it was created with, when it has one: the store is still
   * downloading that file.
   */
  onCreated: (
    result: ProductCreateResult,
    info: {
      previewUrl: string | null
      /** Why some chosen files didn't go up (the product itself was created). */
      uploadProblem?: string | null
      /** How many files were chosen from the computer. */
      uploadedFiles?: number
    },
  ) => void
}

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/**
 * "Add product": one page of cards in place of the list (the list stays mounted behind it) for
 * everything the API accepts on create — title, description, media, organization, price, stock,
 * shipping, options and variants, SEO and metafields. Every card has the same header band
 * (title and a line saying what it is for). Nothing is sent until "Create product", which checks
 * every field first and, when something is wrong, takes you to the first problem. Shopify
 * creates the product (a second or two), and then it is simply in the list: at the top, in the
 * counts, with no refresh.
 */
export function ProductCreateView({
  onBack,
  onCreated,
  onDirtyChange,
}: ProductCreateViewProps) {
  const { shops, selected } = useShops()
  const { create, isCreating, error, uploadStates, clearError } = useCreateProduct()
  // Files chosen from the computer; they are uploaded to the product right after it is created.
  const [files, setFiles] = useState<PickedFile[]>([])
  const [draft, setDraft] = useState<CreateDraft>(() => blankCreateDraft(''))
  const [showErrors, setShowErrors] = useState(false)
  // Counts the Create presses a problem stopped, so the page goes to the first problem each time.
  const [stopped, setStopped] = useState(0)

  // The stores a product can go to; the one picked in the top bar (or the first) is the default.
  const usable = useMemo(() => {
    const live = shops.filter((shop) => shop.connected && shop.is_active)
    return live.length > 0 ? live : shops
  }, [shops])
  const shopOptions: SelectOption[] = usable.map((shop) => ({
    value: shopValue(shop),
    label: shopLabel(shop),
  }))
  const defaultShop = selected !== ALL_SHOPS ? selected : (shopOptions[0]?.value ?? '')
  const shop = draft.shop || defaultShop

  const effective: CreateDraft = useMemo(() => ({ ...draft, shop }), [draft, shop])
  const problems = useMemo(() => validateCreateDraft(effective), [effective])
  const errors = showErrors ? problems : {}
  const { locations } = useStockLocations(shop)

  function update(patch: Partial<CreateDraft>) {
    clearError()
    setDraft((current) => {
      const next = { ...current, ...patch }
      // The variants are the combinations of the options.
      return 'options' in patch ? syncVariants(next) : next
    })
  }

  const dirty = isCreateDirty(effective) || files.length > 0
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  // Asks before throwing away what was entered (nothing typed goes straight back).
  const [discarding, setDiscarding] = useState(false)
  function back() {
    if (dirty) setDiscarding(true)
    else onBack()
  }

  async function submit() {
    setShowErrors(true)
    if (Object.keys(problems).length > 0) {
      setStopped((count) => count + 1)
      return
    }
    const createdShop = shops.find((candidate) => shopValue(candidate) === shop)
    const result = await create(effective, createdShop ?? null, files)
    if (result) {
      onCreated(result.product, {
        previewUrl: firstImageUrl(effective),
        uploadProblem: result.uploadProblem,
        uploadedFiles: files.length,
      })
    }
  }

  // On a long page the first problem can be out of sight: once the errors are on show, go to it
  // (the field with the problem gets the focus; a problem with no field of its own — the store,
  // a collection — falls back to the message at the top).
  const sectionRef = useRef<HTMLElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (stopped === 0) return
    const field = sectionRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (field) field.focus()
    else if (typeof messageRef.current?.scrollIntoView === 'function') {
      messageRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [stopped])

  // A failed create (the backend's message) is above the form: bring it into view.
  useEffect(() => {
    const element = messageRef.current
    if (error && element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [error])

  const createButton = (
    <button
      type="button"
      onClick={() => void submit()}
      disabled={isCreating}
      className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent shadow-sm`}
    >
      {isCreating && <SpinnerIcon width={14} height={14} className="animate-spin" />}
      {isCreating ? 'Creating…' : 'Create product'}
    </button>
  )

  return (
    <section
      ref={sectionRef}
      aria-label="Add product"
      aria-busy={isCreating}
      className="mx-auto flex w-full max-w-6xl flex-col gap-5"
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[1.5rem] leading-tight font-bold">Add product</h2>
          <p className="text-text-muted mt-1 text-[0.85rem]">
            Fill in the details below, then press Create product. Nothing is sent to the
            store until then. Only a title and a price are required.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Same button as on a product's details page. */}
          <button
            type="button"
            onClick={back}
            disabled={isCreating}
            aria-label="Back to list"
            className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowLeftIcon width={16} height={16} />
            <span className="hidden sm:inline" aria-hidden="true">
              Back to list
            </span>
          </button>
          {createButton}
        </div>
      </div>

      <div ref={messageRef} className="flex flex-col gap-2 empty:hidden">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {showErrors && Object.keys(problems).length > 0 && !error && (
          <FormMessage tone="error">
            Fix the highlighted fields to create the product.
          </FormMessage>
        )}
      </div>

      <CreateBasicsCard
        draft={effective}
        errors={errors}
        update={update}
        files={files}
        onFiles={setFiles}
        uploadStates={uploadStates}
        uploading={isCreating}
      />
      <CreateOrganizationCards
        draft={effective}
        errors={errors}
        update={update}
        shopOptions={shopOptions}
        shop={shop}
      />
      <CreatePriceCard draft={effective} errors={errors} update={update} />
      <CreateInventoryCard
        draft={effective}
        errors={errors}
        update={update}
        locations={locations}
      />
      <CreateShippingCard draft={effective} errors={errors} update={update} />
      <CreateVariantsCard draft={effective} errors={errors} update={update} />
      <CreateSeoCard draft={effective} errors={errors} update={update} />
      <CreateMetafieldsCard draft={effective} errors={errors} update={update} />

      <div className="border-border bg-bg sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={back}
          disabled={isCreating}
          className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
        >
          Cancel
        </button>
        {createButton}
      </div>

      {discarding && (
        <ConfirmCancelDialog
          title="Discard this new product?"
          question=""
          detail="What you entered will be lost."
          keepLabel="Keep editing"
          confirmLabel="Yes, discard"
          onConfirm={() => {
            setDiscarding(false)
            onBack()
          }}
          onKeep={() => setDiscarding(false)}
        />
      )}
    </section>
  )
}
