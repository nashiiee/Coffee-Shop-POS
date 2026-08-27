import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/requireAuth.js'
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

productRouter.get('/', ...requireAuth('ADMIN', 'CASHIER'), listProductsHandler)
productRouter.get('/:id', ...requireAuth('ADMIN', 'CASHIER'), getProductHandler)
productRouter.post('/', ...requireAuth('ADMIN'), validate(createProductSchema), createProductHandler)
productRouter.patch('/:id', ...requireAuth('ADMIN'), validate(updateProductSchema), updateProductHandler)
productRouter.delete('/:id', ...requireAuth('ADMIN'), deleteProductHandler)
productRouter.post(
  '/:id/image',
  ...requireAuth('ADMIN'),
  uploadProductImage.single('image'),
  uploadProductImageHandler,
)

productRouter.post(
  '/:id/variants',
  ...requireAuth('ADMIN'),
  validate(createVariantSchema),
  createVariantHandler,
)
productRouter.patch(
  '/:id/variants/:variantId',
  ...requireAuth('ADMIN'),
  validate(updateVariantSchema),
  updateVariantHandler,
)

productRouter.put(
  '/:id/modifiers',
  ...requireAuth('ADMIN'),
  validate(setProductModifiersSchema),
  setProductModifiersHandler,
)
