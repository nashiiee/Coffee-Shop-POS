import type { Discount } from './types'

// Client-side PREVIEW only, so the cashier sees a live total while entering
// cash — the backend independently recomputes everything from the database
// at submit time and is the only value that actually gets charged/recorded.
export function previewDiscountAmount(subtotal: number, discount: Discount | null): number {
  if (!discount || subtotal <= 0) return 0
  if (discount.type === 'PERCENTAGE') {
    return Math.floor((subtotal * discount.value) / 100)
  }
  return Math.min(discount.value, subtotal)
}

export function previewTotal(subtotal: number, discountAmount: number): number {
  const total = subtotal - discountAmount
  return total < 0 ? 0 : total
}
