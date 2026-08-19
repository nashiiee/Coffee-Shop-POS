// Pure, DB-free monetary math for checkout. All amounts are integer cents
// (centavos) — never floats — so results are always exact, never subject to
// floating-point rounding error. Every function here is a straight input ->
// output computation with no side effects, so it can (and must) be unit
// tested exhaustively without a database.

export interface ResolvedLine {
  unitPrice: number
  modifierPrices: number[]
  quantity: number
}

export function calcLineSubtotal(line: ResolvedLine): number {
  const modifierSum = line.modifierPrices.reduce((sum, price) => sum + price, 0)
  return (line.unitPrice + modifierSum) * line.quantity
}

export function calcSubtotal(lines: ResolvedLine[]): number {
  return lines.reduce((sum, line) => sum + calcLineSubtotal(line), 0)
}

export interface DiscountInput {
  type: 'PERCENTAGE' | 'FIXED'
  value: number
}

// Percentage discounts round DOWN (floor) in the shop's favor by a fraction
// of a centavo at most — consistent, predictable, and never lets a discount
// round the total below what a FIXED discount of the same nominal value
// would produce. A FIXED discount is capped at the subtotal so it can never
// drive the total negative on its own (calcTotal also clamps, defensively).
export function calcDiscountAmount(subtotal: number, discount: DiscountInput | null): number {
  if (!discount || subtotal <= 0) return 0
  if (discount.type === 'PERCENTAGE') {
    return Math.floor((subtotal * discount.value) / 100)
  }
  return Math.min(discount.value, subtotal)
}

export function calcTotal(subtotal: number, discountAmount: number): number {
  const total = subtotal - discountAmount
  return total < 0 ? 0 : total
}

export interface CashValidationResult {
  isValid: boolean
  changeGiven: number
  shortfall: number
}

export function validateCashPayment(total: number, amountReceived: number): CashValidationResult {
  if (amountReceived < 0 || total < 0) {
    return { isValid: false, changeGiven: 0, shortfall: Math.max(total, 0) }
  }
  if (amountReceived < total) {
    return { isValid: false, changeGiven: 0, shortfall: total - amountReceived }
  }
  return { isValid: true, changeGiven: amountReceived - total, shortfall: 0 }
}
