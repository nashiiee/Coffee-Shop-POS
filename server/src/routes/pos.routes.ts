import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'

export const posRouter = Router()

posRouter.use(authenticate, authorize('ADMIN', 'CASHIER'))

posRouter.get('/session', (req, res) => {
  res.status(200).json({ role: req.user!.role, message: 'POS area — cart and checkout arrive in later phases' })
})
