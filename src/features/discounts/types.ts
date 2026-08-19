import type { Discount } from '../checkout/types'

export type { Discount }

export interface CreateDiscountPayload {
  name: string
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  expiresAt?: string
}

export interface UpdateDiscountPayload {
  name?: string
  type?: 'PERCENTAGE' | 'FIXED'
  value?: number
  isActive?: boolean
  expiresAt?: string | null
}
