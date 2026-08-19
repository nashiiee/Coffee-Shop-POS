import type { NextFunction, Request, Response } from 'express'
import * as modifierService from '../services/modifier.service.js'
import type { CreateModifierInput, UpdateModifierInput } from '../schemas/modifier.schema.js'

export async function listModifiersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const modifiers = await modifierService.listModifiers(req.query.activeOnly === 'true')
    res.status(200).json(modifiers)
  } catch (err) {
    next(err)
  }
}

export async function createModifierHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const modifier = await modifierService.createModifier(req.body as CreateModifierInput)
    res.status(201).json(modifier)
  } catch (err) {
    next(err)
  }
}

export async function updateModifierHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const modifier = await modifierService.updateModifier(req.params.id as string, req.body as UpdateModifierInput, req.user!.id)
    res.status(200).json(modifier)
  } catch (err) {
    next(err)
  }
}
