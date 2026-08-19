import { z } from 'zod'

// Deliberately does NOT accept price, subtotal, discount amount, or total
// fields from the client — only identifiers and quantities. Zod strips
// unknown keys by default, so even if a manipulated client sends a `total`
// or `unitPrice` field, it is silently discarded before the service layer
// ever sees the request body. All monetary values are recomputed
// server-side from live catalog data inside checkout.service.ts.
export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  modifierIds: z.array(z.string().min(1)).default([]),
  quantity: z.number().int().positive().max(100),
})

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Cart must contain at least one item'),
  discountId: z.string().min(1).optional(),
  amountReceived: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
})

export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
