import type { NextFunction, Request, Response } from 'express'
import * as inventoryService from '../services/inventory.service.js'
import type { AdjustInventoryInput, UpdateReorderLevelInput } from '../schemas/inventory.schema.js'

export async function listInventoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await inventoryService.listInventory(req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function getInventoryItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await inventoryService.getInventoryItem(req.params.productId as string, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function updateReorderLevelHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await inventoryService.updateReorderLevel(
      req.params.productId as string,
      req.body as UpdateReorderLevelInput,
      req.user!.shopId,
    )
    res.status(200).json(item)
  } catch (err) {
    next(err)
  }
}

export async function getInventoryHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await inventoryService.getInventoryHistory(req.params.productId as string, req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function adjustInventoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await inventoryService.adjustInventory(
      req.params.productId as string,
      req.body as AdjustInventoryInput,
      req.user!.id,
      req.user!.shopId,
    )
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}
