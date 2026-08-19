import { describe, expect, it } from 'vitest'
import {
  calcDiscountAmount,
  calcLineSubtotal,
  calcSubtotal,
  calcTotal,
  validateCashPayment,
  type ResolvedLine,
} from '../src/services/checkoutCalculations.js'

describe('calcLineSubtotal', () => {
  it('multiplies unit price by quantity with no modifiers', () => {
    expect(calcLineSubtotal({ unitPrice: 25000, modifierPrices: [], quantity: 2 })).toBe(50000)
  })

  it('adds modifier prices before multiplying by quantity', () => {
    // (₱120.00 + ₱15.00) * 3 = ₱405.00, in centavos: (12000+1500)*3 = 40500
    expect(calcLineSubtotal({ unitPrice: 12000, modifierPrices: [1500], quantity: 3 })).toBe(40500)
  })

  it('sums multiple modifiers', () => {
    expect(calcLineSubtotal({ unitPrice: 10000, modifierPrices: [500, 300], quantity: 1 })).toBe(10800)
  })

  it('handles a zero-price free item', () => {
    expect(calcLineSubtotal({ unitPrice: 0, modifierPrices: [], quantity: 5 })).toBe(0)
  })
})

describe('calcSubtotal', () => {
  it('sums across multiple lines — matches the ₱100.00 + ₱35.50 example', () => {
    const lines: ResolvedLine[] = [
      { unitPrice: 10000, modifierPrices: [], quantity: 1 },
      { unitPrice: 3550, modifierPrices: [], quantity: 1 },
    ]
    expect(calcSubtotal(lines)).toBe(13550)
  })

  it('returns 0 for an empty cart', () => {
    expect(calcSubtotal([])).toBe(0)
  })
})

describe('calcDiscountAmount', () => {
  it('computes a percentage discount', () => {
    expect(calcDiscountAmount(10000, { type: 'PERCENTAGE', value: 20 })).toBe(2000)
  })

  it('floors a percentage discount that does not divide evenly', () => {
    // 10001 * 20 / 100 = 2000.2 -> floors to 2000
    expect(calcDiscountAmount(10001, { type: 'PERCENTAGE', value: 20 })).toBe(2000)
  })

  it('computes a fixed discount', () => {
    expect(calcDiscountAmount(10000, { type: 'FIXED', value: 1500 })).toBe(1500)
  })

  it('caps a fixed discount at the subtotal so it cannot exceed it', () => {
    expect(calcDiscountAmount(1000, { type: 'FIXED', value: 5000 })).toBe(1000)
  })

  it('returns 0 when no discount is given', () => {
    expect(calcDiscountAmount(10000, null)).toBe(0)
  })

  it('returns 0 for a zero subtotal regardless of discount', () => {
    expect(calcDiscountAmount(0, { type: 'PERCENTAGE', value: 50 })).toBe(0)
  })

  it('handles a 100% discount', () => {
    expect(calcDiscountAmount(10000, { type: 'PERCENTAGE', value: 100 })).toBe(10000)
  })
})

describe('calcTotal', () => {
  it('subtracts the discount from the subtotal — matches the ₱200.00 - ₱135.50 style example', () => {
    expect(calcTotal(20000, 6450)).toBe(13550)
  })

  it('never goes negative even if discount somehow exceeds subtotal', () => {
    expect(calcTotal(1000, 5000)).toBe(0)
  })

  it('returns the full subtotal when there is no discount', () => {
    expect(calcTotal(13550, 0)).toBe(13550)
  })
})

describe('validateCashPayment', () => {
  it('accepts exact payment with zero change', () => {
    expect(validateCashPayment(45000, 45000)).toEqual({ isValid: true, changeGiven: 0, shortfall: 0 })
  })

  it('computes change for an overpayment — ₱500 received on a ₱450 total', () => {
    expect(validateCashPayment(45000, 50000)).toEqual({ isValid: true, changeGiven: 5000, shortfall: 0 })
  })

  it('rejects insufficient payment and reports the shortfall — ₱400 received on a ₱450 total', () => {
    expect(validateCashPayment(45000, 40000)).toEqual({ isValid: false, changeGiven: 0, shortfall: 5000 })
  })

  it('rejects a negative amount received', () => {
    const result = validateCashPayment(45000, -100)
    expect(result.isValid).toBe(false)
    expect(result.changeGiven).toBe(0)
  })

  it('rejects a negative total as invalid rather than computing a negative shortfall', () => {
    const result = validateCashPayment(-100, 500)
    expect(result.isValid).toBe(false)
  })

  it('accepts a zero total paid with zero cash (fully discounted order)', () => {
    expect(validateCashPayment(0, 0)).toEqual({ isValid: true, changeGiven: 0, shortfall: 0 })
  })
})
