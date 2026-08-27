import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'

export const posRouter = Router()

posRouter.use(...requireAuth('ADMIN', 'CASHIER'))

posRouter.get('/session', (req, res) => {
  res.status(200).json({ role: req.user!.role, message: 'POS area — cart and checkout arrive in later phases' })
})
