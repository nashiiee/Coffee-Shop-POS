import { apiAssetUrl } from './apiClient'

// Stock photos for seed-catalog menu items that have no admin-uploaded photo
// yet — matched by name (case-insensitive), display-only, not a schema
// field. Unmatched products (e.g. pastries) have no entry; callers fall
// back to a generic icon.
const PRODUCT_IMAGES: Record<string, string> = {
  cappuccino: '/images/products/cappuccino.jpg',
  latte: '/images/products/latte.jpg',
  'cold brew': '/images/products/cold-brew.jpg',
  americano: '/images/products/americano.jpg',
}

export function getProductImage(name: string): string | null {
  return PRODUCT_IMAGES[name.trim().toLowerCase()] ?? null
}

// An admin-uploaded photo (imageUrl, served by the API) always wins over the
// generic stock photo — that's the whole point of letting them attach one.
export function resolveProductImage(name: string, imageUrl?: string | null): string | null {
  if (imageUrl) return apiAssetUrl(imageUrl)
  return getProductImage(name)
}
