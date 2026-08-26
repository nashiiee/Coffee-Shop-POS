import type { Product, ProductVariant } from '../../catalog/types'
import { formatCents } from '../../../lib/money'

export function activeVariants(product: Product): ProductVariant[] {
  return product.variants.filter((v) => v.isActive)
}

export function activeModifiers(product: Product) {
  return product.modifiers.filter((link) => link.modifier.isActive)
}

export function displayPrice(product: Product): string {
  const variants = activeVariants(product)
  if (variants.length === 0) {
    return formatCents(product.basePrice)
  }
  const lowest = Math.min(...variants.map((v) => v.price))
  return formatCents(lowest)
}

export function needsPicker(product: Product): boolean {
  return activeVariants(product).length > 0 || activeModifiers(product).length > 0
}

// Size-only products (no modifiers to configure) skip the picker entirely —
// each size renders as its own tappable chip that adds straight to the cart.
export function isQuickAddEligible(product: Product): boolean {
  return activeVariants(product).length > 0 && activeModifiers(product).length === 0
}
