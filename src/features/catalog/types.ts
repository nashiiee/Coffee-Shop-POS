export interface Category {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
  parentId: string | null
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  price: number
  isActive: boolean
}

export interface Modifier {
  id: string
  name: string
  price: number
  isActive: boolean
}

export interface ProductModifierLink {
  productId: string
  modifierId: string
  modifier: Modifier
}

export interface Product {
  id: string
  categoryId: string
  name: string
  description: string | null
  basePrice: number
  isActive: boolean
  imageUrl: string | null
  category: Category
  variants: ProductVariant[]
  modifiers: ProductModifierLink[]
}
