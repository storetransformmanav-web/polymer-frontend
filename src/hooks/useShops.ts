import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../app/store/hooks.ts'
import {
  ALL_SHOPS,
  DEFAULT_SHOP_NAME,
  fetchShops,
  shopDefaultApplied,
  shopSelected,
  shopValue,
} from '../app/store/shopSlice.ts'

/**
 * The stores the signed-in user may see and which one the app is scoped to,
 * backed by the `shop` Redux slice. Loads the list on first use. Pages don't
 * need this to filter their data — the products/customers slices follow the
 * selection themselves — it's for the top-bar dropdown, which also starts on the default store.
 */
export function useShops() {
  const dispatch = useAppDispatch()
  const shops = useAppSelector((state) => state.shop.items)
  const status = useAppSelector((state) => state.shop.status)
  const selected = useAppSelector((state) => state.shop.selected)
  const defaultApplied = useAppSelector((state) => state.shop.defaultApplied)

  useEffect(() => {
    void dispatch(fetchShops())
  }, [dispatch])

  // Each visit starts on the default store (when this user may see it), once the stores are
  // known; the people's own later choice, "All shops" included, is never overridden.
  useEffect(() => {
    if (status !== 'ready' || defaultApplied) return
    const preferred = shops.find(
      (shop) => shop.name?.trim().toLowerCase() === DEFAULT_SHOP_NAME.toLowerCase(),
    )
    if (preferred) dispatch(shopSelected(shopValue(preferred)))
    else dispatch(shopDefaultApplied())
  }, [dispatch, status, defaultApplied, shops])

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
