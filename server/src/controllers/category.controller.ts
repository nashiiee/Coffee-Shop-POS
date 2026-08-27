import type { NextFunction, Request, Response } from 'express'
import * as categoryService from '../services/category.service.js'
import type { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js'

export async function listCategoriesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await categoryService.listCategories(
      req.query.activeOnly === 'true',
      req.user!.role,
      req.user!.shopId,
    )
    res.status(200).json(categories)
  } catch (err) {
    next(err)
  }
}

export async function createCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await categoryService.createCategory(req.body as CreateCategoryInput, req.user!.shopId)
    res.status(201).json(category)
  } catch (err) {
    next(err)
  }
}

export async function updateCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await categoryService.updateCategory(
      req.params.id as string,
      req.body as UpdateCategoryInput,
      req.user!.id,
      req.user!.shopId,
    )
    res.status(200).json(category)
  } catch (err) {
    next(err)
  }
}
