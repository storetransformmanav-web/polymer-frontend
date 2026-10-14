import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/store/hooks.ts'
import { ALL_SHOPS, fetchShops, shopSelected, shopValue } from '../app/store/shopSlice.ts'

/**
 * The stores the signed-in user may see and which one the app is scoped to,
 * backed by the `shop` Redux slice. Loads the list on first use. Pages don't
 * need this to filter their data — the products/customers slices follow the
 * selection themselves — it's for the top-bar dropdown.
 */
export function useShops() {
  const dispatch = useAppDispatch()
  const shops = useAppSelector((state) => state.shop.items)
  const status = useAppSelector((state) => state.shop.status)
  const selected = useAppSelector((state) => state.shop.selected)

  useEffect(() => {
    void dispatch(fetchShops())
  }, [dispatch])

  // The chosen store is no longer one the user can see → back to "all".
  const isKnown =
    selected === ALL_SHOPS || shops.some((shop) => shopValue(shop) === selected)
  useEffect(() => {
    if (status === 'ready' && !isKnown) dispatch(shopSelected(ALL_SHOPS))
  }, [dispatch, status, isKnown])

  return {
    shops,
    status,
    selected,
    select: (value: string) => dispatch(shopSelected(value)),
  }
}
