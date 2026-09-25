import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store.ts'

/**
 * Typed versions of `useDispatch`/`useSelector` — use these instead of
 * the plain react-redux hooks everywhere in the app, so action and
 * state types are inferred instead of `any`.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
