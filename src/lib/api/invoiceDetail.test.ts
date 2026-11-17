import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError.ts'
import { readInvoiceDetail } from './invoiceDetail.ts'

describe('readInvoiceDetail', () => {
  it('reads the invoice, its customer, lines, VAT rows and payments', () => {
    const detail = readInvoiceDetail({
      invoice_number: '649409',
      kind: 'invoice',
      kind_label: 'Invoice',
      currency: 'GBP',
      customer_order_number: 'PO-1',
      customer_name: 'Acme Ltd',
      account_ref: 'ACC1',
      lines: [
        {
          position: 1,
          stock_code: 'A1',
          description: 'Bag',
          quantity: 2,
          unit_price: 3,
          net: 6,
        },
        { position: 2, description: 'A note' },
      ],
      vat_analysis: [
        { rate: 20, net: 6, tax: 1.2 },
        { rate: 0, net: 4, tax: 0 },
      ],
      payments: [{ reference: 'P1', amount: 7.2 }],
    })

    expect(detail.number).toBe('649409')
    expect(detail.kindLabel).toBe('Invoice')
    expect(detail.customerOrderNumber).toBe('PO-1')
    expect(detail.customer.name).toBe('Acme Ltd')
    expect(detail.customer.accountRef).toBe('ACC1')
    expect(detail.lines).toHaveLength(2)
    expect(detail.lines[0].stockCode).toBe('A1')
    expect(detail.lines[0].net).toBe(6)
    expect(detail.lines[1].isTextLine).toBe(true)
    expect(detail.vat).toHaveLength(2)
    expect(detail.payments).toEqual([{ reference: 'P1', amount: 7.2 }])
  })

  it('unwraps an answer wrapped in `invoice`', () => {
    const detail = readInvoiceDetail({ invoice: { invoice_number: '7', lines: [] } })
    expect(detail.number).toBe('7')
  })

  it('leaves what the answer does not say empty, never broken', () => {
    const detail = readInvoiceDetail({ invoice_number: '8', lines: [], payments: [] })

    expect(detail.invoiceAddress).toBeNull()
    expect(detail.deliveryAddress).toBeNull()
    expect(detail.vat).toEqual([])
    expect(detail.payments).toEqual([])
    expect(detail.customer.email).toBe('')
    expect(detail.posted).toBeNull()
  })

  it('refuses an answer that is not an invoice', () => {
    expect(() => readInvoiceDetail('nope')).toThrow(ApiError)
    expect(() => readInvoiceDetail({})).toThrow(ApiError)
  })
})
