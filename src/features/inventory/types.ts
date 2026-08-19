export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK'
export type InventoryTransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'WASTE'

export interface InventoryProductRef {
  id: string
  name: string
  isActive: boolean
}

export interface InventoryItem {
  id: string
  productId: string
  quantityOnHand: number
  reorderLevel: number
  status: StockStatus
  product: InventoryProductRef
}

export interface InventoryTransaction {
  id: string
  type: InventoryTransactionType
  quantityChange: number
  quantityAfter: number
  reason: string | null
  idempotencyKey: string | null
  createdByUserId: string
  createdBy: { id: string; name: string }
  createdAt: string
}

export interface AdjustInventoryResult {
  transaction: InventoryTransaction
  item: InventoryItem
}
