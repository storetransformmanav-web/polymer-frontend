import { useQuery } from '@tanstack/react-query'
import { api, type CustomerDetail } from '../../../lib/api/endpoints.ts'

/** How many audit-log entries the timeline reads (the API's page can hold up to 200). */
const PAGE_SIZE = 100

/**
 * What staff did to this customer, from the audit log (`GET /activity` narrowed to the customer:
 * `entity_type=customer&entity_id=<id>`), newest first. Asked for only when the Timeline tab is open
 * and the person may view the activity log (`enabled`); the log is for administrators, so a refusal
 * is not an error here — the timeline just has no staff entries. Cached 30 s, never retried.
 */
export function useCustomerActivity(customer: CustomerDetail, enabled: boolean) {
  const query = useQuery({
    queryKey: ['customer-activity', customer.id],
    queryFn: () =>
      api.activity.list({
        entity_type: 'customer',
        entity_id: customer.id,
        page_size: PAGE_SIZE,
      }),
    enabled,
    staleTime: 30_000,
    retry: false,
  })
  return {
    items: query.data?.items ?? [],
    isPending: enabled && query.isPending,
    /** The log could not be read (no permission, or the API said no). */
    unavailable: enabled && query.isError,
  }
}
