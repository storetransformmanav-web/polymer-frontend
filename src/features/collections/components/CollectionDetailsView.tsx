import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_CARD,
  DetailSection,
  DetailSkeleton,
  Field,
} from '../../../components/ui/DetailSection.tsx'
import { DetailsHeader, HeaderChip } from '../../../components/ui/DetailsHeader.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  StoreIcon,
  ClockIcon,
  FileTextIcon,
  GlobeIcon,
  GridIcon,
  type IconProps,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  ProductsIcon,
  UploadIcon,
  TrashIcon,
} from '../../../components/ui/icons.tsx'
import { RichTextEditor } from '../../../components/ui/RichTextEditor.tsx'
import { SafeHtml } from '../../../components/ui/SafeHtml.tsx'
import { useAccess } from '../../../hooks/useAccess.ts'
import type {
  CollectionDetail,
  CollectionRuleOptions,
  CollectionUpdateBody,
} from '../../../lib/api/endpoints.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { formatDateTimeAmPm } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { ProductLightbox, type LightboxSlide } from '../../products/index.ts'
import {
  useCollectionDetails,
  useCollectionRuleOptions,
  useUpdateCollection,
} from '../hooks/useCollections.ts'
import {
  buildUpdateBody,
  draftFromCollection,
  isSmart,
  validateCollectionDraft,
  type CollectionDraft,
  type DraftErrors,
} from '../utils/collectionDraft.ts'
import { count, MESSAGE_BUTTON } from '../utils/ui.ts'
import { CollectionConfirm } from './CollectionConfirm.tsx'
import { CollectionMetafieldsPanel } from './CollectionMetafields.tsx'
import { CollectionDeleteDialog } from './CollectionDeleteDialog.tsx'
import { CollectionImageDialog } from './CollectionImageDialog.tsx'
import { ImageFields, RulesEditor } from './CollectionFormParts.tsx'
import {
  CollectionTextValue,
  EditableCard,
  SortOrderValue,
  type CollectionTextField,
  type SaveCollection,
} from './CollectionInlineEdits.tsx'
import { CollectionImage, Message, TypeBadge } from './CollectionParts.tsx'
import { CollectionProducts } from './CollectionProducts.tsx'

type TabId = 'overview' | 'products'

const TABS: { id: TabId; label: string; icon: ComponentType<IconProps> }[] = [
  { id: 'overview', label: 'Overview', icon: GridIcon },
  { id: 'products', label: 'Products', icon: ProductsIcon },
]

interface CollectionDetailsViewProps {
  id: string
  /** The store the page is scoped to ('' = every store). */
  shop: string
  onBack: () => void
  /** The collection is known: its title for the tab. */
  onLoaded?: (collection: CollectionDetail) => void
  /** The collection was deleted (in Shopify and the CRM): the page closes it; `message` is the backend's. */
  onDeleted?: (message: string) => void
}

/**
 * One collection, laid out like a product's page: a header (picture, title, type, the facts as
 * chips, Back to list), then tabs — **Overview** (picture, details, description,
 * search engine listing and, for an automated collection, its conditions — each value and card has
 * its own pencil, as on a product's page, and sends only its own change with
 * `PUT /collections/{id}`) and **Products** (one page at a time). Writes need the `products`
 * manage permission.
 */
export function CollectionDetailsView({
  id,
  shop,
  onBack,
  onLoaded,
  onDeleted,
}: CollectionDetailsViewProps) {
  const details = useCollectionDetails(id, shop)
  const collection = details.collection
  const { canManage } = useAccess('products')
  const [tab, setTab] = useState<TabId>('overview')
  const [notice, setNotice] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const ref = collection?.id ?? id
  const writeShop = collection?.shop?.key ?? shop
  const { update } = useUpdateCollection(ref, writeShop)
  const smart = isSmart(collection?.collection_type)
  // The condition choices and Shopify's product orders (for the pencils), loaded once and kept.
  const rules = useCollectionRuleOptions(canManage || smart)

  // Tell the page the collection's name (for its tab) once it is known, and when it changes.
  const loadedTitle = collection?.title
  useEffect(() => {
    if (collection) onLoaded?.(collection)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the name changes
  }, [loadedTitle])

  if (details.error) {
    return (
      <section className="border-border bg-bg rounded-2xl border">
        <Message>
          <AlertTriangleIcon width={28} height={28} className="text-danger" />
          <div>
            <p className="text-text font-semibold">Couldn&apos;t load this collection</p>
            <p>{details.error}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={MESSAGE_BUTTON} onClick={details.retry}>
              Try again
            </button>
            <button type="button" className={MESSAGE_BUTTON} onClick={onBack}>
              Back to list
            </button>
          </div>
        </Message>
      </section>
    )
  }

  if (!collection) {
    return (
      <section className="border-border bg-bg rounded-2xl border p-5">
        <DetailSkeleton />
      </section>
    )
  }

  async function send(body: CollectionUpdateBody) {
    setNotice(null)
    const result = await update(body)
    setNotice(result.message)
  }

  // The visible words are for the eye; `HeaderChip` already gives a screen reader its label.
  const facts = (
    <>
      <HeaderChip icon={ProductsIcon} label="Products">
        <span aria-hidden="true" className="text-text-muted">
          Products:
        </span>{' '}
        <span className="font-semibold">{count(collection.products_count)}</span>
      </HeaderChip>
      {collection.shop?.name && (
        <HeaderChip icon={StoreIcon} label="Store">
          <span aria-hidden="true" className="text-text-muted">
            Store:
          </span>{' '}
          <span className="font-semibold">{collection.shop.name}</span>
        </HeaderChip>
      )}
      {collection.shopify_updated_at && (
        <HeaderChip icon={ClockIcon} label="Last updated in Shopify">
          <span aria-hidden="true" className="text-text-muted">
            Last updated in Shopify:
          </span>{' '}
          <span className="font-semibold">
            {formatDateTimeAmPm(collection.shopify_updated_at)}
          </span>
        </HeaderChip>
      )}
    </>
  )

  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <DetailsHeader
        className="border-border mx-4 mt-3 shrink-0 border-b pb-2.5 sm:mx-5"
        visual={<CollectionImage src={collection.image_url} size="lg" />}
        title={collection.title}
        titleHint={collection.title}
        status={
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-text-muted text-[0.8rem] font-medium">
                Collection type:
              </span>
              <TypeBadge type={collection.collection_type} />
            </span>
            {collection.shop?.name && (
              <span className="text-text-muted text-[0.8rem]">
                {collection.shop.name}
              </span>
            )}
            {details.isFetching && (
              <span className="text-text-muted text-[0.75rem]" role="status">
                Updating…
              </span>
            )}
          </>
        }
        chips={facts}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              title="Delete this collection"
              className="border-border bg-bg text-text-muted hover:text-danger hover:border-danger inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[0.82rem] font-semibold transition-colors"
            >
              <TrashIcon width={15} height={15} />
              Delete
            </button>
          ) : null
        }
        onBack={onBack}
      />

      <div
        role="tablist"
        aria-label="Collection sections"
        className="border-border mx-4 flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto border-b sm:mx-5 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`collection-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="collection-tabpanel"
              onClick={() => setTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-2.5 text-[0.88rem] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'border-accent text-accent'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              <item.icon width={17} height={17} />
              {item.label}
              {item.id === 'products' && (
                <span className="bg-surface text-text-muted border-border rounded-full border px-1.5 py-0.5 text-[0.68rem] font-bold">
                  {count(collection.products_count)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div
        id="collection-tabpanel"
        role="tabpanel"
        aria-labelledby={`collection-tab-${tab}`}
        className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {notice && <FormMessage tone="success">{notice}</FormMessage>}

        {tab === 'overview' ? (
          <Overview
            collection={collection}
            canManage={canManage}
            ruleOptions={rules.options}
            onSave={send}
          />
        ) : (
          <>
            {/* The order the collection's products are listed in belongs with the products. */}
            <dl className="border-border bg-bg m-0 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5">
              <dt className="text-text-muted text-[0.68rem] font-bold tracking-wide uppercase">
                Product order
              </dt>
              <dd className="m-0 text-[0.85rem] font-medium">
                <SortOrderValue
                  value={collection.sort_order ?? ''}
                  sortOrders={rules.options?.sort_orders ?? []}
                  canEdit={canManage}
                  onSave={send}
                  collectionTitle={collection.title}
                />
              </dd>
            </dl>
            <CollectionProducts
              collection={collection}
              details={details}
              canManage={canManage}
              onSave={send}
            />
          </>
        )}
      </div>

      {deleting && (
        <CollectionDeleteDialog
          collection={{
            id: collection.id,
            title: collection.title,
            shop: collection.shop?.key ?? (shop || null),
            productsCount: collection.products_count ?? null,
          }}
          onClose={() => setDeleting(false)}
          onDone={(message) => {
            setDeleting(false)
            onDeleted?.(message)
          }}
        />
      )}
    </article>
  )
}

/** The fields each section card changes (its problems are the only ones it shows). */
const IMAGE_FIELDS = ['imageUrl', 'imageAlt']
const pick = (errors: DraftErrors, keys: (key: string) => boolean): DraftErrors =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => keys(key)))

/**
 * The Overview tab, edited in place like a product's page: a small pencil on each value (title,
 * URL handle, product order, page title, meta description) and a pencil in the title row of the
 * Image, Conditions and Description cards. Every change asks "Are you sure?" and sends only
 * itself (`PUT /collections/{id}`); without the `products` manage permission there are no pencils.
 */
function Overview({
  collection,
  canManage,
  ruleOptions,
  onSave,
}: {
  collection: CollectionDetail
  canManage: boolean
  ruleOptions: CollectionRuleOptions | null
  onSave: SaveCollection
}) {
  const conditions = collection.rule_set?.conditions ?? []
  const columns = ruleOptions?.columns ?? []
  // The picture opens in the same viewer as a product's pictures; its alt text is changed there.
  const [lightbox, setLightbox] = useState(false)
  // The window to add or change the picture from the computer.
  const [uploading, setUploading] = useState(false)
  // The question before the picture is taken off (`PUT /collections/{ref}` `{ remove_image: true }`).
  const [removing, setRemoving] = useState(false)
  const [altSaving, setAltSaving] = useState(false)
  const [altError, setAltError] = useState<string | null>(null)
  const pictureSrc = safeUrl(collection.image_url)
  const slides: LightboxSlide[] = pictureSrc
    ? [
        {
          src: pictureSrc,
          alt: collection.image_alt?.trim() || collection.title,
          altText: collection.image_alt ?? '',
          id: 'collection-image',
        },
      ]
    : []
  const altEditor = {
    // Only the alt text is sent (`PUT /collections/{id}` `{ image_alt }`); the viewer asks first.
    save: async (_imageId: string, alt: string) => {
      setAltSaving(true)
      setAltError(null)
      try {
        await onSave({ image_alt: alt })
        return true
      } catch (error) {
        setAltError(toUserMessage(error))
        return false
      } finally {
        setAltSaving(false)
      }
    },
    isSaving: altSaving,
    error: altError,
    clearError: () => setAltError(null),
  }
  const before = () => draftFromCollection(collection)
  const title = collection.title
  const textValue = (field: CollectionTextField, value: string, display?: ReactNode) => (
    <CollectionTextValue
      field={field}
      value={value}
      canEdit={canManage}
      onSave={onSave}
      collectionTitle={title}
      display={display}
    />
  )

  return (
    <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="flex min-w-0 flex-col gap-3">
        <div className={`${DETAIL_CARD} overflow-hidden p-0`}>
          {pictureSrc ? (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              aria-label={`View the image of ${collection.title}`}
              title="Click to view the image"
              className="block w-full cursor-zoom-in border-none bg-transparent p-0"
            >
              <CollectionImage
                src={collection.image_url}
                size="xl"
                alt={collection.image_alt ?? collection.title}
              />
            </button>
          ) : (
            <CollectionImage
              src={collection.image_url}
              size="xl"
              alt={collection.image_alt ?? collection.title}
            />
          )}
        </div>
        {canManage && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploading(true)}
                className="border-border bg-bg text-text hover:border-accent hover:text-accent flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border text-[0.82rem] font-semibold transition-colors"
              >
                <UploadIcon width={15} height={15} />
                {collection.image_url ? 'Change Image' : 'Upload Image'}
              </button>
              {collection.image_url && (
                <button
                  type="button"
                  onClick={() => setRemoving(true)}
                  aria-label="Remove the image"
                  title="Remove the image"
                  className="border-border bg-bg text-text-muted hover:border-danger hover:text-danger flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors"
                >
                  <TrashIcon width={15} height={15} />
                </button>
              )}
            </div>
            {removing && (
              <CollectionConfirm
                title="Remove the picture?"
                confirmLabel="Yes, remove"
                danger
                onClose={() => setRemoving(false)}
                onConfirm={async () => {
                  await onSave({ remove_image: true })
                  setRemoving(false)
                }}
              >
                <p className="m-0">
                  The picture is taken off the collection, also in Shopify.
                </p>
              </CollectionConfirm>
            )}
            {uploading && (
              <CollectionImageDialog
                collection={collection}
                onSave={onSave}
                onClose={() => setUploading(false)}
              />
            )}
          </>
        )}
        <ProductLightbox
          slides={slides}
          index={lightbox ? 0 : null}
          onClose={() => setLightbox(false)}
          altEditor={canManage ? altEditor : undefined}
        />
        {/* A collection with a picture changes its alt text in the viewer; one without has this card to add one. */}
        {!collection.image_url && (
          <EditableCard<CollectionDraft>
            title="Image"
            icon={ImageIcon}
            canEdit={canManage}
            collectionTitle={title}
            onSave={onSave}
            start={before}
            build={(draft) => buildUpdateBody(before(), draft, columns)}
            validate={(draft) =>
              pick(validateCollectionDraft(draft, columns), (key) =>
                IMAGE_FIELDS.includes(key),
              )
            }
            view={
              <dl className="m-0 flex flex-col gap-1">
                <dt className="text-text-muted text-[0.68rem] font-bold tracking-wide uppercase">
                  Alt text
                </dt>
                <dd className="m-0 text-[0.85rem] break-words">
                  {collection.image_alt?.trim() || (
                    <span className="text-text-muted">—</span>
                  )}
                </dd>
              </dl>
            }
            editor={(draft, change, errors) => (
              <ImageFields
                draft={draft}
                errors={errors}
                onChange={(changes) => change({ ...draft, ...changes })}
                idPrefix="collection-image"
                canRemove={Boolean(collection.image_url)}
              />
            )}
          />
        )}
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <DetailSection tinted compact title="Collection details" icon={LayersIcon}>
          {/* One row of three facts with a thin rule between them (stacked on a phone). */}
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-0">
            {[
              <Field key="title" label="Title">
                {textValue('title', collection.title)}
              </Field>,
              <Field key="handle" label="URL handle">
                {textValue(
                  'handle',
                  collection.handle,
                  <span>/{collection.handle}</span>,
                )}
              </Field>,
              <Field key="shopify-id" label="Shopify ID">
                {collection.shopify_id ? (
                  <span className="inline-flex items-center gap-1.5">
                    {collection.shopify_id}
                    <CopyButton
                      value={String(collection.shopify_id)}
                      label="Copy Shopify ID"
                    />
                  </span>
                ) : null}
              </Field>,
            ].map((field) => (
              <dl
                key={field.key}
                className="border-border m-0 min-w-0 sm:border-l sm:px-4 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0"
              >
                {field}
              </dl>
            ))}
          </div>
        </DetailSection>

        {isSmart(collection.collection_type) && (
          <EditableCard<CollectionDraft>
            title="Conditions"
            icon={ListChecksIcon}
            count={conditions.length}
            canEdit={canManage && ruleOptions !== null}
            collectionTitle={title}
            onSave={onSave}
            start={before}
            build={(draft) => buildUpdateBody(before(), draft, columns)}
            validate={(draft) =>
              pick(validateCollectionDraft(draft, columns), (key) =>
                key.startsWith('conditions'),
              )
            }
            view={
              conditions.length === 0 ? (
                <p className="text-text-muted m-0 text-[0.85rem]">No conditions.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-text-muted m-0 text-[0.82rem]">
                    Products must match{' '}
                    <strong className="text-text">
                      {collection.rule_set?.match === 'any'
                        ? 'any condition'
                        : 'all conditions'}
                    </strong>
                    :
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                    {conditions.map((condition, index) => (
                      <li
                        key={`${condition.column}-${index}`}
                        className="border-border bg-surface rounded-lg border px-3 py-2 text-[0.85rem]"
                      >
                        {condition.label ??
                          `${condition.column} ${condition.relation} ${condition.condition ?? ''}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            }
            editor={(draft, change, errors) =>
              ruleOptions ? (
                <div className="flex flex-col gap-3">
                  <p className="text-text-muted m-0 text-[0.8rem]">
                    The full set replaces the old conditions when you save.
                  </p>
                  <RulesEditor
                    options={ruleOptions}
                    match={draft.match}
                    conditions={draft.conditions}
                    errors={errors}
                    onChange={(changes) => change({ ...draft, ...changes })}
                    idPrefix="collection-conditions"
                  />
                </div>
              ) : null
            }
          />
        )}

        <EditableCard<CollectionDraft>
          title="Description"
          icon={FileTextIcon}
          canEdit={canManage}
          collectionTitle={title}
          onSave={onSave}
          start={before}
          build={(draft) => buildUpdateBody(before(), draft, columns)}
          view={
            collection.description_html?.trim() ? (
              <SafeHtml
                html={collection.description_html}
                className="text-[0.88rem] leading-relaxed [&_p]:my-2"
              />
            ) : (
              <p className="text-text-muted m-0 text-[0.85rem]">No description.</p>
            )
          }
          editor={(draft, change) => (
            <RichTextEditor
              id="collection-description"
              label="Description"
              value={draft.descriptionHtml}
              onChange={(descriptionHtml) => change({ ...draft, descriptionHtml })}
            />
          )}
        />

        {/* Metafields, then the search engine listing, each the full width (a long saved value would otherwise stretch one card beside a short one). */}
        <div className="flex flex-col gap-3">
          <CollectionMetafieldsPanel
            collection={collection}
            canManage={canManage}
            onSave={onSave}
          />

          <DetailSection tinted compact title="Search engine listing" icon={GlobeIcon}>
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-0">
              <dl className="m-0 flex min-w-0 flex-col sm:pr-6">
                <Field label="Page title">
                  {textValue('seo_title', collection.seo_title ?? '')}
                </Field>
              </dl>
              <dl className="border-border m-0 flex min-w-0 flex-col sm:border-l sm:pl-6">
                <Field label="Meta description">
                  {textValue('seo_description', collection.seo_description ?? '')}
                </Field>
              </dl>
            </div>
          </DetailSection>
        </div>
      </div>
    </div>
  )
}
