import type { NextFunction, Request, Response } from 'express'
import * as inventoryService from '../services/inventory.service.js'
import type { AdjustInventoryInput, UpdateReorderLevelInput } from '../schemas/inventory.schema.js'

export async function listInventoryHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await inventoryService.listInventory())
  } catch (err) {
    next(err)
  }
}

export async function getInventoryItemHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await inventoryService.getInventoryItem(req.params.productId as string))
  } catch (err) {
    next(err)
  }
}

export async function updateReorderLevelHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await inventoryService.updateReorderLevel(
      req.params.productId as string,
      req.body as UpdateReorderLevelInput,
    )
    res.status(200).json(item)
  } catch (err) {
    next(err)
  }
}

export async function getInventoryHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await inventoryService.getInventoryHistory(req.params.productId as string))
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
    )
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}
