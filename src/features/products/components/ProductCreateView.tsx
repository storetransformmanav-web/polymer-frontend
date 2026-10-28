import { useEffect, useMemo, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
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
import { CreateSidebarCard } from './create/CreateSidebarCards.tsx'
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
 * "Add product": a full form in place of the list (the list stays mounted behind
 * it) for everything the API accepts on create — title, description, media,
 * options and variants with prices and opening stock, SEO, tags, collections and
 * metafields. Nothing is sent until "Create product", which checks every field
 * first. Shopify creates the product (a second or two), and then it is simply in
 * the list: at the top, in the counts, with no refresh.
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

  function back() {
    if (
      dirty &&
      !window.confirm('Discard this new product? What you entered will be lost.')
    ) {
      return
    }
    onBack()
  }

  async function submit() {
    setShowErrors(true)
    if (Object.keys(problems).length > 0) return
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
      aria-label="Add product"
      aria-busy={isCreating}
      className="flex w-full flex-col gap-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[1.5rem] leading-tight font-bold">Add product</h2>
          <p className="text-text-muted mt-1 text-[0.85rem]">
            Fill in the details below, then press Create product. Nothing is sent to the
            store until then. Only the title and a price are required.
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

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {showErrors && Object.keys(problems).length > 0 && !error && (
        <FormMessage tone="error">
          Fix the highlighted fields to create the product.
        </FormMessage>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <CreateBasicsCard
            draft={effective}
            errors={errors}
            update={update}
            files={files}
            onFiles={setFiles}
            uploadStates={uploadStates}
            uploading={isCreating}
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
          <CreateMetafieldsCard draft={effective} errors={errors} update={update} />
          <CreateSeoCard draft={effective} errors={errors} update={update} />
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-0">
          <CreateSidebarCard
            draft={effective}
            errors={errors}
            update={update}
            shopOptions={shopOptions}
            shop={shop}
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
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
    </section>
  )
}
