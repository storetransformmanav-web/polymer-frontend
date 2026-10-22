import { describe, expect, it } from 'vitest'
import type { CustomerListItem } from '../../../lib/api/endpoints.ts'
import { buildTableFile, pickColumns } from '../../../lib/tableExport.ts'
import { CUSTOMER_EXPORT_COLUMNS } from './exportColumns.ts'

const customer = (over: Partial<CustomerListItem> = {}): CustomerListItem => ({
  shop: {
    key: 'polymer-uk',
    name: 'Polymer UK',
    domain: 'polymer-uk-ltd.myshopify.com',
    currency: 'GBP',
  },
  id: 'cust-1',
  shopify_id: 9876543210123,
  email: 'ian@example.com',
  full_name: 'Ian Rayner',
  first_name: 'Ian',
  last_name: 'Rayner',
  phone: '+44 20 7946 0000',
  role: 'subscriber',
  is_active: true,
  shopify_state: 'ENABLED',
  accepts_marketing: true,
  orders_count: 3,
  total_spent: '145.70',
  currency: 'GBP',
  tags: ['VIP', 'Wholesale'],
  city: 'Winchester',
  country: 'United Kingdom',
  last_order_name: '#1042',
  shopify_created_at: '2026-10-08T12:55:03Z',
  last_login_at: null,
  ...over,
})

const csv = async (items: CustomerListItem[], columns = CUSTOMER_EXPORT_COLUMNS) =>
  (await buildTableFile('csv', items, columns, 'Customers').text()).replace(/^﻿/, '')

describe('the customers columns', () => {
  it('has a header row with every column, in order', async () => {
    const [header] = (await csv([customer()])).split('\r\n')

    expect(header).toBe(
      'Customer ID,Shopify ID,Customer name,Email,Phone,Role,State,Active,Email subscription,Orders,Amount spent,Currency,Tags,Store,Store key,City,Country,Last order,Created (Shopify),Last login',
    )
    expect(CUSTOMER_EXPORT_COLUMNS).toHaveLength(20)
  })

  it('writes every field of a customer, with the words the table uses', async () => {
    const [, row] = (await csv([customer()])).split('\r\n')

    expect(row).toBe(
      [
        'cust-1',
        '9876543210123',
        'Ian Rayner',
        'ian@example.com',
        // A phone number starting with "+" is kept from running as a formula.
        "'+44 20 7946 0000",
        'Subscriber',
        'Enabled',
        'Yes',
        'Subscribed',
        '3',
        '145.70',
        'GBP',
        '"VIP, Wholesale"',
        'Polymer UK',
        'polymer-uk',
        'Winchester',
        'United Kingdom',
        '#1042',
        '2026-10-08T12:55:03Z',
        '',
      ].join(','),
    )
  })

  it('names the customer like the table does when there is no full name, and marks a CRM customer', async () => {
    const [, row] = (
      await csv([
        customer({
          full_name: null,
          first_name: 'Ian',
          last_name: 'Rayner',
          shop: null,
          shopify_id: null,
          shopify_state: null,
          accepts_marketing: false,
          is_active: false,
          role: 'administrator',
          phone: null,
          total_spent: null,
          currency: null,
          tags: [],
          city: null,
          country: null,
          last_order_name: null,
          shopify_created_at: null,
          last_login_at: '2026-10-12T04:51:21Z',
        }),
      ])
    ).split('\r\n')

    expect(row).toBe(
      'cust-1,,Ian Rayner,ian@example.com,,Administrator,CRM,No,Not subscribed,3,,,,,,,,,,2026-10-12T04:51:21Z',
    )
  })

  it('leaves the subscription empty when the customer has no marketing flag', async () => {
    const [header, row] = (
      await csv(
        [customer({ accepts_marketing: null })],
        pickColumns(CUSTOMER_EXPORT_COLUMNS, ['name', 'marketing']),
      )
    ).split('\r\n')

    expect(header).toBe('Customer name,Email subscription')
    expect(row).toBe('Ian Rayner,')
  })

  it('has the Shopify ID as text, and counts and spend as numbers', () => {
    const kind = (id: string) => CUSTOMER_EXPORT_COLUMNS.find((c) => c.id === id)?.kind
    expect(kind('shopifyId')).toBe('text')
    expect(kind('orders')).toBe('integer')
    expect(kind('spent')).toBe('decimal')
  })
})
