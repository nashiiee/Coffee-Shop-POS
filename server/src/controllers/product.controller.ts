import type { NextFunction, Request, Response } from 'express'
import * as productService from '../services/product.service.js'
import * as productImageService from '../services/productImage.service.js'
import { AppError } from '../lib/AppError.js'
import type {
  CreateProductInput,
  CreateVariantInput,
  SetProductModifiersInput,
  UpdateProductInput,
  UpdateVariantInput,
} from '../schemas/product.schema.js'

export async function listProductsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const products = await productService.listProducts(req.query.activeOnly === 'true')
    res.status(200).json(products)
  } catch (err) {
    next(err)
  }
}

export async function getProductHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.getProduct(req.params.id as string)
    res.status(200).json(product)
  } catch (err) {
    next(err)
  }
}

export async function createProductHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.createProduct(req.body as CreateProductInput, req.user!.id)
    res.status(201).json(product)
  } catch (err) {
    next(err)
  }
}

export async function updateProductHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.updateProduct(req.params.id as string, req.body as UpdateProductInput, req.user!.id)
    res.status(200).json(product)
  } catch (err) {
    next(err)
  }
}

export async function uploadProductImageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw AppError.badRequest('No image file provided')
    }
    const result = await productImageService.setProductImage(req.params.id as string, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
    })
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export async function deleteProductHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await productService.deleteProduct(req.params.id as string)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

export async function createVariantHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const variant = await productService.createVariant(req.params.id as string, req.body as CreateVariantInput)
    res.status(201).json(variant)
  } catch (err) {
    next(err)
  }
}

export async function updateVariantHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const variant = await productService.updateVariant(req.params.id as string, req.params.variantId as string, req.body as UpdateVariantInput)
    res.status(200).json(variant)
  } catch (err) {
    next(err)
  }
}

export async function setProductModifiersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.setProductModifiers(req.params.id as string, req.body as SetProductModifiersInput)
    res.status(200).json(product)
  } catch (err) {
    next(err)
  }
}
