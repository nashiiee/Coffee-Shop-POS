import { apiAssetUrl } from './apiClient'

// Stock photos for seed-catalog menu items that have no admin-uploaded photo
// yet — matched by name (case-insensitive), display-only, not a schema
// field. Unmatched products have no entry; callers fall back to a generic
// icon. Several visually-similar flavors intentionally share one photo
// (e.g. every Biscoff/cookie-butter item, every matcha-latte-style item)
// rather than sourcing a near-duplicate shot for each.
const PRODUCT_IMAGES: Record<string, string> = {
  cappuccino: '/images/products/cappuccino.jpg',
  latte: '/images/products/latte.jpg',
  'cold brew': '/images/products/cold-brew.jpg',
  americano: '/images/products/americano.jpg',
  'strawberry milk': '/images/products/strawberry-milk.jpg',
  'mocha frappuccino': '/images/products/mocha-frappuccino.jpg',
  'oreo milkshake': '/images/products/oreo-milkshake.jpg',
  'pink drink': '/images/products/pink-drink.jpg',
  croissant: '/images/products/croissant.jpg',
  chocoberry: '/images/products/chocoberry.jpg',
  'classic chocolate': '/images/products/hot-chocolate.jpg',
  'cocoa latte': '/images/products/hot-chocolate.jpg',
  'cookie butter cream': '/images/products/biscoff.jpg',
  'cookie butter milkshake': '/images/products/biscoff.jpg',
  biscoffee: '/images/products/biscoff.jpg',
  'biscoffee frappuccino': '/images/products/biscoff.jpg',
  'matcha berry': '/images/products/matcha-berry.jpg',
  'matcha berry milkshake': '/images/products/matcha-berry.jpg',
  'matcha latte': '/images/products/matcha-latte.jpg',
  'seasalt matcha latte': '/images/products/matcha-latte.jpg',
  'dirty matcha': '/images/products/matcha-latte.jpg',
  'matcha cream': '/images/products/matcha-latte.jpg',
  'caramel macchiato': '/images/products/caramel-coffee.jpg',
  'salted caramel americano': '/images/products/caramel-coffee.jpg',
  'caramel coffee': '/images/products/caramel-coffee.jpg',
  'hazelnut macchiato': '/images/products/hazelnut-coffee.jpg',
  'hazelnut frappe': '/images/products/hazelnut-coffee.jpg',
  'ice shaken espresso': '/images/products/iced-espresso.jpg',
  'espresso frappuccino': '/images/products/iced-espresso.jpg',
  'sea salt latte': '/images/products/spanish-latte.jpg',
  'spanish latte': '/images/products/spanish-latte.jpg',
  'spanish seasalt oat latte': '/images/products/spanish-latte.jpg',
  'java chips': '/images/products/java-chips.jpg',
  'chocolate chip': '/images/products/java-chips.jpg',
  'choco cream': '/images/products/oreo-milkshake.jpg',
  "strawberries n' cream": '/images/products/strawberry-milk.jpg',
  'lemonade w/ passion fruit': '/images/products/passion-fruit-lemonade.jpg',
  'strawberry lemonade': '/images/products/strawberry-lemonade.jpg',
  brownies: '/images/products/brownies.jpg',
  'revel bar': '/images/products/revel-bar.jpg',
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
