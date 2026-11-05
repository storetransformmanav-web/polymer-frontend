import { useMemo } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../app/store/shopSlice.ts'
import type { SelectOption } from '../components/ui/SelectField.tsx'
import { useShops } from './useShops.ts'

/**
 * The stores a file can be imported into (the connected, active ones, else every one the user
 * can see) and the one to start on: the store picked in the top bar, else the first.
 */
export function useImportStores() {
  const { shops, selected } = useShops()
  const usable = useMemo(() => {
    const live = shops.filter((shop) => shop.connected && shop.is_active)
    return live.length > 0 ? live : shops
  }, [shops])
  const shopOptions: SelectOption[] = usable.map((shop) => ({
    value: shopValue(shop),
    label: shopLabel(shop),
  }))
  const defaultShop = selected !== ALL_SHOPS ? selected : (shopOptions[0]?.value ?? '')
  return { shops, shopOptions, defaultShop }
}
