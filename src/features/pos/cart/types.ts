export interface CartLineModifier {
  modifierId: string
  name: string
  price: number
}

export interface CartLineItem {
  id: string
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  unitPrice: number
  modifiers: CartLineModifier[]
  quantity: number
}

export interface CartState {
  items: CartLineItem[]
  notes: string
}

export interface AddItemPayload {
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  unitPrice: number
  modifiers: CartLineModifier[]
  quantity: number
}
