import { useQuery } from '@tanstack/react-query'
import { activityActionsOptions } from './activityQueries.ts'

/**
 * The choices for the "Action" dropdown: the actions found in the log itself, with how
 * many times each happened.
 *
 * Nothing is requested until `enabled`: the page opens with just its list, and the choices
 * are fetched when the Filters grid is opened.
 */
export function useActivityFilterOptions(enabled = true) {
  const actions = useQuery({ ...activityActionsOptions(), enabled })
  return { actions: actions.data ?? [] }
}
