import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DETAIL_TD, DetailSection } from '../../../components/ui/DetailSection.tsx'
import { GlobeIcon, ProductsIcon, TagIcon } from '../../../components/ui/icons.tsx'
import { safeUrl } from '../../../lib/safeUrl.ts'
import type {
  SageStockDetail,
  SageStockShopifyVariant,
} from '../../../lib/api/sageStock.ts'
import { count, money } from '../utils/format.ts'
import { FILL_BOX, NUMBER_TD, TH_LEFT, TH_RIGHT } from '../utils/tableStyles.ts'
import { FillCard } from './FillCard.tsx'
import { Item, MetricTile } from './SageStockPanels.tsx'

/** Yes / No as a small pill (Yes in the accent colour); nothing when the API says nothing. */
function YesNoPill({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return null
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-0.5 text-[0.82rem] font-semibold ${
        value ? 'bg-accent-tint text-accent' : 'bg-surface text-text-muted'
      }`}
    >
      {value ? 'Yes' : 'No'}
    </span>
  )
}

/** A short id with a copy button; a dash when there is none. */
const copyable = (value: string, label: string): ReactNode =>
  value ? (
    <span className="flex items-center gap-1.5">
      <span className="max-w-[9rem] truncate" title={value}>
        {value}
      </span>
      <CopyButton value={value} label={label} />
    </span>
  ) : (
    '—'
  )

/** A linked variant's picture, small, from an https address only. */
function Thumb({ url }: { url: string }) {
  const src = safeUrl(url)
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="bg-surface border-border text-text-muted flex size-10 shrink-0 items-center justify-center rounded-lg border"
      >
        <ProductsIcon width={16} height={16} />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className="border-border size-10 shrink-0 rounded-lg border object-cover"
    />
  )
}

function VariantRow({ variant }: { variant: SageStockShopifyVariant }) {
  const title = variant.title || variant.sku
  return (
    <tr className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors">
      <td className={`${DETAIL_TD} !whitespace-normal`}>
        <div className="flex min-w-0 items-center gap-3">
          <Thumb url={variant.image_url} />
          <div className="min-w-0">
            {variant.product_id ? (
              <Link
                to={`/products/${encodeURIComponent(variant.product_id)}`}
                className="text-text hover:text-accent font-semibold break-words no-underline hover:underline"
              >
                {title}
              </Link>
            ) : (
              <span className="font-semibold break-words">{title}</span>
            )}
            {variant.handle && (
              <p className="text-text-muted m-0 text-[0.78rem] break-all">
                Handle: {variant.handle}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className={DETAIL_TD}>{variant.variant_title || '—'}</td>
      <td className={DETAIL_TD}>{variant.sku || '—'}</td>
      <td className={NUMBER_TD}>{money(variant.price)}</td>
      <td className={NUMBER_TD}>{count(variant.inventory_quantity)}</td>
      <td className={DETAIL_TD}>{copyable(variant.product_id, 'Copy product ID')}</td>
      <td className={DETAIL_TD}>{copyable(variant.variant_id, 'Copy variant ID')}</td>
    </tr>
  )
}

/** The Shopify Links & Mapping card: how many variants are linked, and each one in a scrolling table. */
function ShopifyLinks({ variants }: { variants: SageStockVariant[] }) {
  return (
    <FillCard title="Shopify Links & Mapping" icon={ProductsIcon}>
      <div className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <span className="text-text-muted text-[0.8rem] font-medium">Linked Products</span>
        <span className="bg-accent-tint text-accent rounded-full px-3 py-0.5 text-[0.85rem] font-bold">
          {count(variants.length)}
        </span>
      </div>
      {variants.length === 0 ? (
        <p className="text-text-muted m-0 p-4 text-[0.85rem]">
          No CRM product has this SKU: it is in Sage only.
        </p>
      ) : (
        <div className={FILL_BOX}>
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                <th className={TH_LEFT}>Product</th>
                <th className={TH_LEFT}>Variant</th>
                <th className={TH_LEFT}>SKU</th>
                <th className={TH_RIGHT}>Price</th>
                <th className={TH_RIGHT}>Inventory</th>
                <th className={TH_LEFT}>Product ID</th>
                <th className={TH_LEFT}>Variant ID</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, index) => (
                <VariantRow key={`${variant.variant_id}-${index}`} variant={variant} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FillCard>
  )
}

type SageStockVariant = SageStockDetail['shopify'][number]

/**
 * The Web & Shopify tab, after the reference design, two columns (the narrow Web Information, a third of
 * the width, and the wide Shopify table): **Web Information** (the published and
 * special-offer tiles, the web description and details, three categories) beside **Shopify Links &
 * Mapping** (the number of linked products and each variant — picture, product, handle, variant, SKU,
 * price, inventory, product and variant ids — in a table that takes the tab's height and scrolls in its
 * own box). Everything shown is the details answer's.
 */
export function WebPanel({ detail }: { detail: SageStockDetail }) {
  const web = detail.web
  return (
    <div className="grid min-w-0 gap-3 lg:min-h-0 lg:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:grid-rows-[minmax(0,1fr)]">
      <div className="self-start">
        <DetailSection compact title="Web Information" icon={GlobeIcon}>
          {web ? (
            <div className="@container flex flex-col">
              <div className="grid grid-cols-1 gap-3 pb-3 @sm:grid-cols-2">
                <MetricTile
                  icon={GlobeIcon}
                  label="Published"
                  value={<YesNoPill value={web.published} />}
                  tone="accent"
                />
                <MetricTile
                  icon={TagIcon}
                  label="Special Offer"
                  value={<YesNoPill value={web.special_offer} />}
                  tone="accent"
                />
              </div>
              <dl className="m-0 flex flex-col">
                <div className="border-border border-y py-2.5">
                  <Item label="Web Description">{web.description}</Item>
                </div>
                <div className="border-border border-b py-2.5">
                  <Item label="Details">{web.details}</Item>
                </div>
                <div className="grid grid-cols-1 gap-y-2.5 pt-2.5 @lg:grid-cols-3 @lg:divide-x">
                  <div className="border-border min-w-0 @lg:pr-4">
                    <Item label="Category 1">{web.category_1}</Item>
                  </div>
                  <div className="border-border min-w-0 @lg:px-4">
                    <Item label="Category 2">{web.category_2}</Item>
                  </div>
                  <div className="border-border min-w-0 @lg:pl-4">
                    <Item label="Category 3">{web.category_3}</Item>
                  </div>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-text-muted m-0 text-[0.85rem]">No web details.</p>
          )}
        </DetailSection>
      </div>

      <ShopifyLinks variants={detail.shopify} />
    </div>
  )
}
