import { z } from 'zod'

const money = z.number().int().nonnegative()

export const createProductSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(150),
  description: z.string().max(1000).optional(),
  basePrice: money,
})

export const updateProductSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    name: z.string().min(1).max(150).optional(),
    description: z.string().max(1000).nullable().optional(),
    basePrice: money.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export const createVariantSchema = z.object({
  name: z.string().min(1).max(100),
  price: money,
})

export const updateVariantSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    price: money.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export const setProductModifiersSchema = z.object({
  modifierIds: z.array(z.string().min(1)),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CreateVariantInput = z.infer<typeof createVariantSchema>
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>
export type SetProductModifiersInput = z.infer<typeof setProductModifiersSchema>
