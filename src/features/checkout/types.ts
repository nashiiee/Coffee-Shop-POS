export interface Discount {
  id: string
  name: string
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  isActive: boolean
  expiresAt: string | null
}

export interface OrderItemModifierRecord {
  id: string
  modifierNameSnapshot: string
  priceSnapshot: number
}

export interface OrderItemRecord {
  id: string
  productNameSnapshot: string
  variantNameSnapshot: string | null
  unitPriceSnapshot: number
  quantity: number
  lineSubtotal: number
  modifiers: OrderItemModifierRecord[]
}

export interface PaymentRecord {
  method: 'CASH'
  amountDue: number
  amountReceived: number
  changeGiven: number
}

export interface OrderRecord {
  id: string
  sequenceNumber: number
  status: string
  subtotal: number
  discountNameSnapshot: string | null
  discountAmount: number
  total: number
  notes: string | null
  createdAt: string
  cashier: { id: string; name: string }
  discount: Discount | null
  items: OrderItemRecord[]
  payment: PaymentRecord
  voidedAt: string | null
  voidedBy: { id: string; name: string } | null
  voidReason: string | null
}

export interface CheckoutItemPayload {
  productId: string
  variantId?: string
  modifierIds: string[]
  quantity: number
}

export interface CheckoutRequest {
  items: CheckoutItemPayload[]
  discountId?: string
  amountReceived: number
  idempotencyKey: string
  notes?: string
}
