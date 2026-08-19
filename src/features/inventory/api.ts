import { apiRequest } from '../../lib/apiClient'
import type { AdjustInventoryResult, InventoryItem, InventoryTransaction, InventoryTransactionType } from './types'

type Token = string | null

export function listInventory(accessToken: Token) {
  return apiRequest<InventoryItem[]>('/api/inventory', { accessToken })
}

export function getInventoryHistory(accessToken: Token, productId: string) {
  return apiRequest<InventoryTransaction[]>(`/api/inventory/${productId}/history`, { accessToken })
}

export function updateReorderLevel(accessToken: Token, productId: string, reorderLevel: number) {
  return apiRequest<InventoryItem>(`/api/inventory/${productId}`, {
    method: 'PATCH',
    body: { reorderLevel },
    accessToken,
  })
}

export function adjustInventory(
  accessToken: Token,
  productId: string,
  data: { type: InventoryTransactionType; quantityChange: number; reason?: string; idempotencyKey?: string },
) {
  return apiRequest<AdjustInventoryResult>(`/api/inventory/${productId}/adjustments`, {
    method: 'POST',
    body: data,
    accessToken,
  })
}
