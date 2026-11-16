import { afterEach, describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatTimestamp } from './format.ts'
import {
  DEFAULT_TIME_ZONE,
  formatRelativeDateTime,
  formatStoreDate,
  formatUpdatedAt,
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

describe('when something was last updated', () => {
  // A Wednesday, 12:00 in London (winter, so London is UTC).
  const now = new Date('2026-11-11T12:00:00Z')

  it('today: how long ago, from the current time', () => {
    expect(formatUpdatedAt('2026-11-11T11:44:00Z', now)).toBe('16 minutes ago')
    expect(formatUpdatedAt('2026-11-11T11:59:00Z', now)).toBe('1 minute ago')
    expect(formatUpdatedAt('2026-11-11T11:59:30Z', now)).toBe('30 seconds ago')
    expect(formatUpdatedAt('2026-11-11T09:00:00Z', now)).toBe('3 hours ago')
  })

  it('never says a time in the future (a clock a little ahead reads as just now)', () => {
    expect(formatUpdatedAt('2026-11-11T12:00:20Z', now)).toBe('now')
  })

  it('yesterday: the word Yesterday and the time, 12-hour with AM / PM', () => {
    expect(formatUpdatedAt('2026-11-10T16:30:00Z', now)).toBe('Yesterday, 4:30 PM')
    expect(formatUpdatedAt('2026-11-10T00:05:00Z', now)).toBe('Yesterday, 12:05 AM')
  })

  it('the days before that, within a week: the weekday and the time', () => {
    expect(formatUpdatedAt('2026-11-09T16:30:00Z', now)).toBe('Monday, 4:30 PM')
    expect(formatUpdatedAt('2026-11-05T09:40:00Z', now)).toBe('Thursday, 9:40 AM')
  })

  it('a week or more ago: the date in full', () => {
    expect(formatUpdatedAt('2026-11-04T10:38:00Z', now)).toBe('November 4, 2026')
    expect(formatUpdatedAt('2026-10-10T10:00:00Z', now)).toBe('October 10, 2026')
    expect(formatUpdatedAt('2025-03-02T10:00:00Z', now)).toBe('March 2, 2025')
  })

  it('moves on with the clock: the same moment reads differently as time passes', () => {
    const moment = '2026-11-11T11:44:00Z'
    expect(formatUpdatedAt(moment, new Date('2026-11-11T12:00:00Z'))).toBe(
      '16 minutes ago',
    )
    expect(formatUpdatedAt(moment, new Date('2026-11-12T12:00:00Z'))).toBe(
      'Yesterday, 11:44 AM',
    )
    expect(formatUpdatedAt(moment, new Date('2026-11-14T12:00:00Z'))).toBe(
      'Wednesday, 11:44 AM',
    )
    expect(formatUpdatedAt(moment, new Date('2026-11-30T12:00:00Z'))).toBe(
      'November 11, 2026',
    )
  })

  it('counts the store’s calendar days, not 24-hour spans', () => {
    // 23:30 on the 10th is yesterday once it is just after midnight on the 11th.
    expect(
      formatUpdatedAt('2026-11-10T23:30:00Z', new Date('2026-11-11T00:10:00Z')),
    ).toBe('Yesterday, 11:30 PM')
  })

  it('shows the store’s clock, whatever the computer’s zone is (British summer time)', () => {
    // 15:30 UTC is 16:30 in London in July.
    expect(
      formatUpdatedAt('2026-07-09T15:30:00Z', new Date('2026-07-10T09:00:00Z')),
    ).toBe('Yesterday, 4:30 PM')
  })

  it('gives nothing for an empty or unreadable value', () => {
    expect(formatUpdatedAt(null, now)).toBe('')
    expect(formatUpdatedAt('', now)).toBe('')
    expect(formatUpdatedAt('not a date', now)).toBe('')
  })
})

describe('relative date and time', () => {
  // A Wednesday noon in London (winter, so London is UTC).
  const now = new Date('2026-11-11T12:00:00Z')

  it('says Today and Yesterday, with a 12-hour time', () => {
    expect(formatRelativeDateTime('2026-11-11T02:10:29Z', now)).toBe('Today at 2:10 am')
    expect(formatRelativeDateTime('2026-11-10T22:45:00Z', now)).toBe(
      'Yesterday at 10:45 pm',
    )
  })

  it('names the weekday for the days before that, up to a week', () => {
    expect(formatRelativeDateTime('2026-11-09T09:40:00Z', now)).toBe('Monday at 9:40 am')
  })

  it('shows the date for anything older than that', () => {
    expect(formatRelativeDateTime('2026-11-04T10:38:00Z', now)).toBe('4 Nov at 10:38 am')
    expect(formatRelativeDateTime('2025-11-04T10:38:00Z', now)).toBe(
      '4 Nov 2025 at 10:38 am',
    )
  })

  it('counts the store’s calendar days, not 24-hour spans', () => {
    // 23:30 UTC on 10 Nov is 23:30 in London; "now" is just after midnight on the 11th.
    expect(
      formatRelativeDateTime('2026-11-10T23:30:00Z', new Date('2026-11-11T00:10:00Z')),
    ).toBe('Yesterday at 11:30 pm')
  })

  it('gives nothing for an empty value', () => {
    expect(formatRelativeDateTime(null, now)).toBe('')
  })
})
