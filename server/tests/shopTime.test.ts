import { describe, expect, it } from 'vitest'
import { shopDayRange, shopMonthRange, shopWeekRange } from '../src/lib/shopTime.js'

describe('shopDayRange', () => {
  it('treats 11:30pm shop-local as still "today", not the next UTC day', () => {
    // 2026-03-15 23:30 in UTC+8 == 2026-03-15 15:30 UTC
    const lateNight = new Date('2026-03-15T15:30:00.000Z')
    const { start, end } = shopDayRange(lateNight)
    expect(start.toISOString()).toBe('2026-03-14T16:00:00.000Z') // 2026-03-15 00:00 UTC+8
    expect(end.toISOString()).toBe('2026-03-15T16:00:00.000Z') // 2026-03-16 00:00 UTC+8
  })

  it('treats 1am shop-local as the NEW day, even though UTC is still the previous calendar day', () => {
    // 2026-03-16 01:00 in UTC+8 == 2026-03-15 17:00 UTC
    const earlyMorning = new Date('2026-03-15T17:00:00.000Z')
    const { start } = shopDayRange(earlyMorning)
    expect(start.toISOString()).toBe('2026-03-15T16:00:00.000Z') // 2026-03-16 00:00 UTC+8
  })

  it('the range is exactly 24 hours and end is exclusive', () => {
    const { start, end } = shopDayRange(new Date('2026-03-15T15:30:00.000Z'))
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })
})

describe('shopWeekRange', () => {
  it('starts on Monday, shop-local', () => {
    // 2026-03-18 is a Wednesday
    const wednesday = new Date('2026-03-18T04:00:00.000Z')
    const { start } = shopWeekRange(wednesday)
    // Monday 2026-03-16 00:00 UTC+8 == 2026-03-15 16:00 UTC
    expect(start.toISOString()).toBe('2026-03-15T16:00:00.000Z')
  })

  it('a Sunday belongs to the week that started the preceding Monday', () => {
    const sunday = new Date('2026-03-22T04:00:00.000Z') // Sunday shop-local
    const { start, end } = shopWeekRange(sunday)
    expect(start.toISOString()).toBe('2026-03-15T16:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe('shopMonthRange', () => {
  it('spans the full shop-local calendar month', () => {
    const midMarch = new Date('2026-03-18T04:00:00.000Z')
    const { start, end } = shopMonthRange(midMarch)
    expect(start.toISOString()).toBe('2026-02-28T16:00:00.000Z') // 2026-03-01 00:00 UTC+8
    expect(end.toISOString()).toBe('2026-03-31T16:00:00.000Z') // 2026-04-01 00:00 UTC+8
  })

  it('correctly rolls over into the next year for December', () => {
    const midDecember = new Date('2026-12-18T04:00:00.000Z')
    const { end } = shopMonthRange(midDecember)
    expect(end.toISOString()).toBe('2026-12-31T16:00:00.000Z') // 2027-01-01 00:00 UTC+8
  })
})
