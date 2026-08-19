import { z } from 'zod'

const money = z.number().int().nonnegative()

export const createModifierSchema = z.object({
  name: z.string().min(1).max(100),
  price: money,
})

export const updateModifierSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    price: money.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export type CreateModifierInput = z.infer<typeof createModifierSchema>
export type UpdateModifierInput = z.infer<typeof updateModifierSchema>
