import { z } from 'zod'

export const createCashierSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(200),
})

export type CreateCashierInput = z.infer<typeof createCashierSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
