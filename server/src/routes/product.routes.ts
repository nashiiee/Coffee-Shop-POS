import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { MAX_PRODUCT_IMAGE_BYTES } from '../services/productImage.service.js'
import {
  createProductSchema,
  createVariantSchema,
  setProductModifiersSchema,
  updateProductSchema,
  updateVariantSchema,
} from '../schemas/product.schema.js'
import {
  createProductHandler,
  createVariantHandler,
  deleteProductHandler,
  getProductHandler,
  listProductsHandler,
  setProductModifiersHandler,
  updateProductHandler,
  updateVariantHandler,
  uploadProductImageHandler,
} from '../controllers/product.controller.js'

const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES },
})

export const productRouter = Router()

productRouter.get('/', authenticate, authorize('ADMIN', 'CASHIER'), listProductsHandler)
productRouter.get('/:id', authenticate, authorize('ADMIN', 'CASHIER'), getProductHandler)
productRouter.post('/', authenticate, authorize('ADMIN'), validate(createProductSchema), createProductHandler)
productRouter.patch('/:id', authenticate, authorize('ADMIN'), validate(updateProductSchema), updateProductHandler)
productRouter.delete('/:id', authenticate, authorize('ADMIN'), deleteProductHandler)
productRouter.post(
  '/:id/image',
  authenticate,
  authorize('ADMIN'),
  uploadProductImage.single('image'),
  uploadProductImageHandler,
)

productRouter.post(
  '/:id/variants',
  authenticate,
  authorize('ADMIN'),
  validate(createVariantSchema),
  createVariantHandler,
)
productRouter.patch(
  '/:id/variants/:variantId',
  authenticate,
  authorize('ADMIN'),
  validate(updateVariantSchema),
  updateVariantHandler,
)

productRouter.put(
  '/:id/modifiers',
  authenticate,
  authorize('ADMIN'),
  validate(setProductModifiersSchema),
  setProductModifiersHandler,
)
