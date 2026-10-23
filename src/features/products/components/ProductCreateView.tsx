import { useEffect, useMemo, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { ArrowLeftIcon, SpinnerIcon } from '../../../components/ui/icons.tsx'
import { RichTextEditor } from '../../../components/ui/RichTextEditor.tsx'
import type { SelectOption } from '../../../components/ui/SelectField.tsx'
import { useShops } from '../../../hooks/useShops.ts'
import type { ProductCreateResult } from '../../../lib/api/endpoints.ts'
import { useCreateProduct } from '../hooks/useCreateProduct.ts'
import { useStockLocations } from '../hooks/useStockLocations.ts'
import {
  blankCreateDraft,
  CREATE_LIMITS,
  firstImageUrl,
  isCreateDirty,
  syncVariants,
  validateCreateDraft,
  type CreateDraft,
} from '../utils/createDraft.ts'
import { LIMITS } from '../utils/editDraft.ts'
import { EditField, FIELD_INPUT, FIELD_TEXTAREA } from './edit/fields.tsx'
import { CreateCard } from './create/CreateCard.tsx'
import {
  CreateMetafieldsCard,
  CreateOrganizationCard,
  CreateStatusCard,
} from './create/CreateSidebarCards.tsx'
import { CreateVariantsCard } from './create/CreateVariantsCard.tsx'
import { MediaRows } from './MediaRows.tsx'

interface ProductCreateViewProps {
  onBack: () => void
  /** Tells the page whether the form holds anything typed (its tab asks before closing). */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * The product exists (it is already in the cached list). `previewUrl` is the
   * image address it was created with, when it has one: the store is still
   * downloading that file.
   */
  onCreated: (result: ProductCreateResult, info: { previewUrl: string | null }) => void
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
  const { create, isCreating, error, clearError } = useCreateProduct()
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
  const pictures = [...new Set(draft.media.map((row) => row.url.trim()).filter(Boolean))]

  function update(patch: Partial<CreateDraft>) {
    clearError()
    setDraft((current) => {
      const next = { ...current, ...patch }
      // The variants are the combinations of the options.
      return 'options' in patch ? syncVariants(next) : next
    })
  }

  const dirty = isCreateDirty(effective)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  function back() {
    if (
      isCreateDirty(effective) &&
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
    const result = await create(effective, createdShop ?? null)
    if (result) onCreated(result, { previewUrl: firstImageUrl(effective) })
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
      className="flex flex-col gap-4"
    >
      <div className="border-border bg-bg flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-2.5">
        <button
          type="button"
          onClick={back}
          disabled={isCreating}
          className="text-text hover:text-accent inline-flex h-9 cursor-pointer items-center gap-2 border-none bg-transparent px-1 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowLeftIcon width={16} height={16} />
          Back
        </button>
        <div className="bg-border hidden h-6 w-px sm:block" aria-hidden="true" />
        <h2 className="text-[0.95rem] font-semibold">Add product</h2>
        <div className="ml-auto">{createButton}</div>
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {showErrors && Object.keys(problems).length > 0 && !error && (
        <FormMessage tone="error">
          Fix the highlighted fields to create the product.
        </FormMessage>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <CreateCard title="Basics">
            <EditField
              id="create-title"
              label="Title"
              error={errors.title}
              counter={{ value: draft.title.trim().length, max: LIMITS.title }}
            >
              <input
                id="create-title"
                autoComplete="off"
                autoFocus
                value={draft.title}
                aria-invalid={errors.title ? true : undefined}
                onChange={(event) => update({ title: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
            <EditField id="create-description" label="Description" optional>
              <RichTextEditor
                id="create-description"
                label="Description"
                value={draft.descriptionHtml}
                onChange={(descriptionHtml) => update({ descriptionHtml })}
              />
            </EditField>
          </CreateCard>

          <CreateCard
            title="Media"
            description="Pictures for the whole product, by public web address — the store downloads them, and the first image is the featured one. A variant's own picture is set in its row under Options and variants (it is added here automatically)."
          >
            <MediaRows
              rows={draft.media}
              onChange={(media) => update({ media })}
              errors={errors}
              prefix="media."
              max={CREATE_LIMITS.media}
              idPrefix="create-media"
              minRows={0}
            />
            {errors['media.rows'] && (
              <p role="alert" className="text-danger text-[0.78rem]">
                {errors['media.rows']}
              </p>
            )}
          </CreateCard>

          <CreateVariantsCard
            draft={effective}
            errors={errors}
            update={update}
            locations={locations}
            pictures={pictures}
          />

          <CreateCard
            title="Search listing"
            description="How the product appears in search results and its web address."
          >
            <EditField
              id="create-seo-title"
              label="SEO title"
              optional
              error={errors.seoTitle}
              counter={{ value: draft.seoTitle.trim().length, max: LIMITS.seoTitle }}
            >
              <input
                id="create-seo-title"
                autoComplete="off"
                value={draft.seoTitle}
                aria-invalid={errors.seoTitle ? true : undefined}
                onChange={(event) => update({ seoTitle: event.target.value })}
                className={FIELD_INPUT}
              />
            </EditField>
            <EditField
              id="create-seo-description"
              label="SEO description"
              optional
              error={errors.seoDescription}
              counter={{
                value: draft.seoDescription.trim().length,
                max: LIMITS.seoDescription,
              }}
            >
              <textarea
                id="create-seo-description"
                rows={3}
                value={draft.seoDescription}
                aria-invalid={errors.seoDescription ? true : undefined}
                onChange={(event) => update({ seoDescription: event.target.value })}
                className={FIELD_TEXTAREA}
              />
            </EditField>
            <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2">
              <EditField
                id="create-handle"
                label="Handle"
                optional
                error={errors.handle}
                hint="Leave blank and the store makes one from the title."
              >
                <input
                  id="create-handle"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.handle}
                  aria-invalid={errors.handle ? true : undefined}
                  onChange={(event) => update({ handle: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
              <EditField
                id="create-template"
                label="Template suffix"
                optional
                error={errors.templateSuffix}
              >
                <input
                  id="create-template"
                  autoComplete="off"
                  value={draft.templateSuffix}
                  aria-invalid={errors.templateSuffix ? true : undefined}
                  onChange={(event) => update({ templateSuffix: event.target.value })}
                  className={FIELD_INPUT}
                />
              </EditField>
            </div>
          </CreateCard>

          <CreateMetafieldsCard draft={effective} errors={errors} update={update} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <CreateStatusCard
            draft={effective}
            errors={errors}
            update={update}
            shopOptions={shopOptions}
            shop={shop}
          />
          <CreateOrganizationCard draft={effective} errors={errors} update={update} />
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
