import { describe, expect, it } from 'vitest'
import { dollarsToCents, formatCents, formatOrderNumber } from './money'

describe('dollarsToCents', () => {
  it('converts a whole-peso amount to cents', () => {
    expect(dollarsToCents('45')).toBe(4500)
  })

  it('converts a two-decimal amount to cents', () => {
    expect(dollarsToCents('45.50')).toBe(4550)
  })

  it('rounds a sub-centavo amount to the nearest cent', () => {
    expect(dollarsToCents('45.005')).toBe(4501)
    expect(dollarsToCents('45.004')).toBe(4500)
  })

  it('treats an empty string as zero', () => {
    expect(dollarsToCents('')).toBe(0)
  })

  it('converts a negative amount to negative cents', () => {
    // No sign guard here by design — callers (checkout cash-received input,
    // price entry fields) constrain this via `min="0"` at the form layer;
    // this just documents the pass-through, not a validated invariant.
    expect(dollarsToCents('-10')).toBe(-1000)
  })

  it('returns NaN for a non-numeric string rather than throwing', () => {
    // Also documents current behavior, not a validated invariant — an
    // un-parseable string silently produces NaN. Callers must not persist
    // this without checking Number.isFinite() first.
    expect(dollarsToCents('not-a-number')).toBeNaN()
  })
})

describe('formatCents', () => {
  it('formats a whole-peso amount with the PHP currency symbol', () => {
    expect(formatCents(4500)).toBe('₱45.00')
  })

  it('formats zero', () => {
    expect(formatCents(0)).toBe('₱0.00')
  })

  it('formats a large amount with thousands separators', () => {
    expect(formatCents(1234567)).toBe('₱12,345.67')
  })

  it('formats a negative amount', () => {
    expect(formatCents(-500)).toBe('-₱5.00')
  })
})

describe('formatOrderNumber', () => {
  it('pads a sequence number to 6 digits with a leading hash', () => {
    expect(formatOrderNumber(7)).toBe('#000007')
  })

  it('does not truncate a sequence number already 6+ digits', () => {
    expect(formatOrderNumber(1234567)).toBe('#1234567')
  })
})
