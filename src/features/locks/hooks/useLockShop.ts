import { useMemo } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { useShops } from '../../../hooks/useShops.ts'

/**
 * The store the lock pages work on. Every `/access/*` call needs exactly one store, so with
 * "All shops" picked in the top bar the first connected store is used (as the Add product
 * form does); the page says which one it is.
 */
export function useLockShop() {
  const { shops, selected, status } = useShops()

  return useMemo(() => {
    const live = shops.filter((shop) => shop.connected && shop.is_active)
    const usable = live.length > 0 ? live : shops
    const chosen =
      selected !== ALL_SHOPS
        ? usable.find((shop) => shopValue(shop) === selected)
        : undefined
    const shop = chosen ?? usable[0]
    return {
      /** The key sent as `shop`; '' until the stores have loaded. */
      shop: shop ? shopValue(shop) : '',
      shopName: shop ? shopLabel(shop) : '',
      status,
    }
  }, [shops, selected, status])
}
