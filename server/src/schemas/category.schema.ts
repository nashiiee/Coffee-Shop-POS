import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().default(0),
  parentId: z.string().min(1).nullable().optional(),
})

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    parentId: z.string().min(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
