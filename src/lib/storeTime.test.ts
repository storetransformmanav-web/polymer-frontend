import { afterEach, describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatTimestamp } from './format.ts'
import {
  DEFAULT_TIME_ZONE,
  formatStoreDate,
  getStoreTimeZone,
  setStoreTimeZone,
  storeTimeToIso,
  storeToday,
} from './storeTime.ts'

afterEach(() => {
  setStoreTimeZone(null)
})

describe('store time zone', () => {
  it('shows a time on the store’s clock, whatever the computer’s zone is', () => {
    // Shopify shows 02:10 for this order; an Indian computer would have said 07:40.
    expect(formatStoreDate('2026-11-11T02:10:29Z')).toBe('11 Nov 2026, 02:10')
    expect(formatDateTime('2026-11-11T02:10:29Z')).toBe('11 Nov 2026, 02:10')
  })

  it('follows British summer time by itself (Europe/London is never hard-coded to +0)', () => {
    expect(formatStoreDate('2026-07-01T00:30:00Z')).toBe('01 Jul 2026, 01:30')
    expect(formatStoreDate('2026-12-01T00:30:00Z')).toBe('01 Dec 2026, 00:30')
  })

  it('uses a 24-hour clock, so midnight is 00:xx and never 24:xx', () => {
    expect(formatStoreDate('2026-12-01T00:05:00Z')).toBe('01 Dec 2026, 00:05')
  })

  it('formats the day alone and a timestamp with seconds in the store’s zone too', () => {
    // 23:30 UTC on 30 June is already 1 July in London (BST).
    expect(formatDate('2026-06-30T23:30:00Z')).toBe('1 Jul 2026')
    expect(formatTimestamp('2026-11-11T02:10:29Z')).toBe('11 Nov 2026, 02:10:29')
  })

  it('uses the zone it was given, and falls back to Europe/London when there is none', () => {
    expect(setStoreTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata')
    expect(formatStoreDate('2026-11-11T02:10:29Z')).toBe('11 Nov 2026, 07:40')
    expect(setStoreTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE)
    expect(setStoreTimeZone('Not/AZone')).toBe(DEFAULT_TIME_ZONE)
    expect(getStoreTimeZone()).toBe('Europe/London')
  })

  it('gives nothing for an empty value', () => {
    expect(formatStoreDate('')).toBe('')
    expect(formatStoreDate(null)).toBe('')
  })

  it('turns a day on the store’s clock into the instant the API wants', () => {
    // Winter: London is UTC.
    expect(storeTimeToIso('2026-11-11', '00:00:00')).toBe('2026-11-11T00:00:00.000Z')
    expect(storeTimeToIso('2026-11-11', '23:59:59')).toBe('2026-11-11T23:59:59.000Z')
    // Summer: London is an hour ahead, so the day starts at 23:00 UTC the day before.
    expect(storeTimeToIso('2026-07-01', '00:00:00')).toBe('2026-06-30T23:00:00.000Z')
    expect(storeTimeToIso('2026-07-01', '23:59:59')).toBe('2026-07-01T22:59:59.000Z')
    expect(storeTimeToIso('nope', '00:00:00')).toBeUndefined()
  })

  it('"today" is the store’s calendar day', () => {
    const today = storeToday()
    const text = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
    }).format(new Date())
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(ymd).toBe(text)
  })
})
