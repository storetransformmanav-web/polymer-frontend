import { useQuery } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import {
  INVOICE_KIND_ALL,
  INVOICE_PARAM,
  type Invoice,
} from '../../../lib/api/invoices.ts'

/** Is this row the invoice the address names (its number, and its type when the address has one)? */
export function isInvoice(
  invoice: Invoice,
  number: string,
  kind: string | null,
): boolean {
  return (
    invoice.number.toLowerCase() === number.toLowerCase() &&
    (!kind || invoice.kind === kind)
  )
}

/**
 * One invoice for its page. The API has one list and no single-invoice route, so the page draws
 * from the row already loaded in the list (`preview`: nothing is asked for, it opens at once);
 * reached by its address alone (a reload, a bookmark) it is found by searching the list for its
 * number — one request, cached.
 */
export function useInvoiceDetails(
  number: string,
  kind: string | null,
  preview: Invoice | null,
) {
  const lookup = useQuery({
    queryKey: ['invoice', number, kind],
    queryFn: async () => {
      const answer = await api.invoices.list({
        [INVOICE_PARAM.kind]: kind || INVOICE_KIND_ALL,
        [INVOICE_PARAM.search]: number,
        [INVOICE_PARAM.page]: 1,
        [INVOICE_PARAM.pageSize]: 25,
      })
      return answer.items.find((item) => isInvoice(item, number, kind)) ?? null
    },
    enabled: preview === null && number !== '',
    staleTime: 30_000,
  })

  return {
    invoice: preview ?? lookup.data ?? null,
    isPending: preview === null && lookup.isPending,
    error: preview === null && lookup.isError ? toUserMessage(lookup.error) : null,
    /** Asked, and the list has no such invoice. */
    notFound: preview === null && lookup.isSuccess && lookup.data === null,
    retry: () => void lookup.refetch(),
  }
}
