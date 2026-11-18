import { useEffect, useMemo, useState } from 'react'
import { DETAIL_CARD } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { HeaderBackButton } from '../../../components/ui/DetailsHeader.tsx'
import {
  BoltIcon,
  FileTextIcon,
  ImageIcon,
  LayersIcon,
  PlusIcon,
  ProductsIcon,
  SearchIcon,
  SpinnerIcon,
  TagIcon,
} from '../../../components/ui/icons.tsx'
import type { CollectionDetail } from '../../../lib/api/endpoints.ts'
import { useStoreTags } from '../../products/index.ts'
import {
  useCollectionRuleOptions,
  useCreateCollection,
  useMetafieldDefinitions,
} from '../hooks/useCollections.ts'
import { newMetafieldWrites, type MetafieldDrafts } from '../utils/metafieldDraft.ts'
import { MetafieldsCard } from './CollectionMetafields.tsx'
import {
  blankCollectionDraft,
  blankCondition,
  buildCreateBody,
  MAX_CONDITIONS,
  isDraftDirty,
  rulesOf,
  validateCollectionDraft,
  type CollectionDraft,
  type CollectionKind,
  type DraftErrors,
} from '../utils/collectionDraft.ts'
import { CollectionConfirm } from './CollectionConfirm.tsx'
import { CollectionTypeToggle, RulePreview } from './CollectionSetup.tsx'
import { fieldErrorsFrom } from '../utils/fieldErrors.ts'
import { uploadCollectionImage } from '../utils/uploadImage.ts'
import {
  BasicsFields,
  FormCard,
  ImageUploadField,
  ProductPicker,
  RulesEditor,
  SeoFields,
} from './CollectionFormParts.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../utils/ui.ts'

interface CollectionCreateViewProps {
  /** The store the collection is made in. */
  shop: string
  shopName: string
  onBack: () => void
  /** The store answered: `message` to show, and the new collection to open. */
  onCreated: (message: string, collection: CollectionDetail) => void
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * **Add collection**, in place of the list (laid out like Add product): a heading with Back to list
 * and Create collection, then a wide column — Basics (title, description), the collection type
 * (**Manual**: search and pick products, all the store's suggested on focus; **Smart**: the conditions, from `GET /collections/rule-options`, and the products they match)
 * and the search engine listing — with the picture beside the details. **Only the section of the chosen type shows** (the chosen products as a scrolling, paged table for Manual; the conditions and their matching products for Smart); there is no product order. Create checks
 * every field, asks first and sends one `POST /collections` (`products` or `rules`, never both).
 */
export function CollectionCreateView({
  shop,
  shopName,
  onBack,
  onCreated,
  onDirtyChange,
}: CollectionCreateViewProps) {
  const [draft, setDraft] = useState<CollectionDraft>(blankCollectionDraft)
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<DraftErrors>({})
  const [confirming, setConfirming] = useState(false)
  // No type is chosen to begin with: neither section shows until Manual or Smart is pressed.
  const [chosenKind, setChosenKind] = useState<CollectionKind | null>(null)
  // The picture chosen from the computer: kept here and uploaded when the collection is created.
  const [imageFile, setImageFile] = useState<File | null>(null)
  const rules = useCollectionRuleOptions()
  // The store's metafields for collections (the short description, the FAQ…) and what is filled in.
  const metafieldDefinitions = useMetafieldDefinitions(shop).definitions
  const [metafieldDrafts, setMetafieldDrafts] = useState<MetafieldDrafts>({})
  // The store's tags, offered in the value box of a Tag condition (asked for once Smart is chosen).
  const storeShops = useMemo(() => (shop ? [shop] : []), [shop])
  const { tags: storeTags } = useStoreTags(storeShops, {
    enabled: chosenKind === 'smart',
  })
  const { create } = useCreateCollection()
  const columns = rules.columns

  const problems = useMemo(
    () => validateCollectionDraft(draft, columns),
    [draft, columns],
  )
  const errors: DraftErrors = { ...(showErrors ? problems : {}), ...serverErrors }
  const hasProblems = chosenKind === null || Object.keys(problems).length > 0
  // The conditions are complete (nothing left to fill in): the preview of matching products can ask.
  const conditionsReady =
    draft.kind === 'smart' &&
    draft.conditions.length > 0 &&
    !Object.keys(problems).some((key) => key.startsWith('conditions'))

  const dirty =
    isDraftDirty(draft) ||
    imageFile !== null ||
    Object.values(metafieldDrafts).some(
      (value) => value.text.trim() !== '' || value.entries.length > 0,
    )
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  function change(changes: Partial<CollectionDraft>) {
    setServerErrors({})
    setDraft((current) => ({ ...current, ...changes }))
  }

  function chooseKind(kind: CollectionDraft['kind']) {
    setChosenKind(kind)
    change({
      kind,
      // An automated collection starts with one condition row.
      conditions:
        kind === 'smart' && draft.conditions.length === 0 && columns.length > 0
          ? [blankCondition(columns)]
          : draft.conditions,
    })
  }

  function submit() {
    setShowErrors(true)
    if (!shop) return
    if (hasProblems) {
      // The first field with a problem gets the focus.
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    setConfirming(true)
  }

  return (
    <div className="relative flex flex-col gap-4">
      <header className={`${DETAIL_CARD} flex flex-wrap items-center gap-3 p-3 sm:px-4`}>
        <span
          aria-hidden="true"
          className="bg-accent text-accent-contrast flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        >
          <TagIcon width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-lg leading-tight font-bold">Add Collection</h1>
          <p className="text-text-muted m-0 text-[0.76rem]">
            {shopName ? `In ${shopName}. ` : ''}It is made in Shopify too.
          </p>
        </div>
        <HeaderBackButton onClick={onBack} />
        <button
          type="button"
          onClick={submit}
          disabled={!shop}
          className={PRIMARY_BUTTON}
        >
          <PlusIcon width={15} height={15} />
          Create collection
        </button>
      </header>

      {showErrors && hasProblems && (
        <FormMessage tone="error">
          Fix the highlighted fields to create the collection.
        </FormMessage>
      )}

      {/* The form on the left (details, type, the chosen type's section, metafields, SEO); the picture on the right. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <FormCard
            icon={FileTextIcon}
            title="Collection details"
            invalid={Boolean(errors.title || errors.descriptionHtml)}
          >
            <BasicsFields
              draft={draft}
              errors={errors}
              onChange={change}
              idPrefix="new-collection"
              compactDescription
            />
          </FormCard>

          <FormCard
            icon={LayersIcon}
            title="Collection type"
            actions={<CollectionTypeToggle kind={chosenKind} onChange={chooseKind} />}
            error={
              showErrors && chosenKind === null ? 'Choose a collection type.' : undefined
            }
          ></FormCard>

          {chosenKind === 'custom' ? (
            <FormCard
              icon={ProductsIcon}
              title="Products"
              description="Search the store's products and add the ones you want (optional)."
            >
              <ProductPicker
                listAll
                table
                shop={shop}
                picked={draft.products}
                onChange={(products) => change({ products })}
                error={errors.products}
                idPrefix="new-collection"
              />
            </FormCard>
          ) : chosenKind === 'smart' ? (
            <FormCard
              icon={BoltIcon}
              title="Smart conditions"
              description="Products that match the conditions are added on their own."
              actions={
                <button
                  type="button"
                  disabled={
                    draft.conditions.length >= MAX_CONDITIONS || columns.length === 0
                  }
                  onClick={() =>
                    change({ conditions: [...draft.conditions, blankCondition(columns)] })
                  }
                  className="border-border bg-bg text-text hover:border-accent inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.78rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                  <PlusIcon width={13} height={13} />
                  Add another condition
                </button>
              }
            >
              {rules.error ? (
                <FormMessage tone="error">
                  {`Could not load the condition choices: ${rules.error}`}
                </FormMessage>
              ) : rules.options ? (
                <>
                  <RulesEditor
                    options={rules.options}
                    match={draft.match}
                    conditions={draft.conditions}
                    errors={errors}
                    onChange={change}
                    idPrefix="new-collection"
                    hideMatch
                    hideAdd
                    tags={storeTags}
                  />
                  <RulePreview
                    shop={shop}
                    rules={conditionsReady ? rulesOf(draft, columns) : null}
                  />
                </>
              ) : (
                <p className="text-text-muted m-0 flex items-center gap-2 text-[0.82rem]">
                  <SpinnerIcon width={14} height={14} className="animate-spin" />
                  Loading the condition choices…
                </p>
              )}
            </FormCard>
          ) : null}

          <MetafieldsCard
            shop={shop}
            drafts={metafieldDrafts}
            onChange={(next) => {
              setServerErrors({})
              setMetafieldDrafts(next)
            }}
          />

          <FormCard
            icon={SearchIcon}
            title="Search engine listing"
            invalid={Boolean(errors.seoTitle || errors.seoDescription)}
          >
            <SeoFields
              draft={draft}
              errors={errors}
              onChange={change}
              idPrefix="new-collection"
            />
          </FormCard>
        </div>
        <div className="lg:sticky lg:top-4">
          <FormCard
            icon={ImageIcon}
            title="Image"
            description="Upload a picture from your computer."
          >
            <ImageUploadField
              file={imageFile}
              onFile={(file) => {
                setServerErrors({})
                setImageFile(file)
              }}
              alt={draft.imageAlt}
              onAlt={(imageAlt) => change({ imageAlt })}
              idPrefix="new-collection"
            />
          </FormCard>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onBack} className={SECONDARY_BUTTON}>
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!shop}
          className={PRIMARY_BUTTON}
        >
          <PlusIcon width={15} height={15} />
          Create collection
        </button>
      </div>

      {confirming && (
        <CollectionConfirm
          title={`Create “${draft.title.trim()}”?`}
          confirmLabel="Yes, create"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            try {
              const body = buildCreateBody(draft, shop, columns)
              const metafields = newMetafieldWrites(metafieldDefinitions, metafieldDrafts)
              if (metafields.length > 0) body.metafields = metafields
              if (imageFile) {
                // The picture goes to the store's file storage first; its address then goes in the body.
                body.image_url = await uploadCollectionImage(imageFile, shop)
              } else {
                // An alt text needs a picture to belong to.
                delete body.image_alt
              }
              const result = await create(body)
              setConfirming(false)
              onCreated(result.message, result.collection)
            } catch (error) {
              setServerErrors(fieldErrorsFrom(error))
              throw error
            }
          }}
        >
          <p className="m-0">
            A {draft.kind === 'smart' ? 'smart' : 'manual'} collection
            {draft.kind === 'custom' && draft.products.length > 0
              ? ` with ${draft.products.length} ${draft.products.length === 1 ? 'product' : 'products'}`
              : ''}
            {draft.kind === 'smart'
              ? ` with ${draft.conditions.length} ${draft.conditions.length === 1 ? 'condition' : 'conditions'}`
              : ''}{' '}
            will be made in {shopName || 'the store'}.
          </p>
          <p className="text-text-muted m-0">
            It is saved in Shopify first, which can take a few seconds.
          </p>
        </CollectionConfirm>
      )}
    </div>
  )
}
