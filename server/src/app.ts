import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { PRODUCT_UPLOADS_DIR } from './services/productImage.service.js'
import { SHOP_UPLOADS_DIR } from './services/shopLogo.service.js'
import { authRouter } from './routes/auth.routes.js'
import { usersRouter } from './routes/users.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { posRouter } from './routes/pos.routes.js'
import { categoryRouter } from './routes/category.routes.js'
import { productRouter } from './routes/product.routes.js'
import { modifierRouter } from './routes/modifier.routes.js'
import { inventoryRouter } from './routes/inventory.routes.js'
import { discountRouter } from './routes/discount.routes.js'
import { expenseRouter } from './routes/expense.routes.js'
import { checkoutRouter } from './routes/checkout.routes.js'
import { orderRouter } from './routes/order.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  // Helmet's default Cross-Origin-Resource-Policy (same-origin) would block
  // the frontend (a different origin/port in dev) from loading these <img>
  // sources, so this mount explicitly opts back in to cross-origin reads —
  // scoped to just the static uploads, not the JSON API.
  app.use(
    '/uploads/products',
    (_req, res, next) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin')
      next()
    },
    express.static(PRODUCT_UPLOADS_DIR),
  )

  app.use(
    '/uploads/shops',
    (_req, res, next) => {
      res.set('Cross-Origin-Resource-Policy', 'cross-origin')
      next()
    },
    express.static(SHOP_UPLOADS_DIR),
  )

  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/pos', posRouter)
  app.use('/api/categories', categoryRouter)
  app.use('/api/products', productRouter)
  app.use('/api/modifiers', modifierRouter)
  app.use('/api/inventory', inventoryRouter)
  app.use('/api/discounts', discountRouter)
  app.use('/api/expenses', expenseRouter)
  app.use('/api/checkout', checkoutRouter)
  app.use('/api/orders', orderRouter)

  app.use(errorHandler)

  return app
}
