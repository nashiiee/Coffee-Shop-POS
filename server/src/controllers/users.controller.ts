import type { NextFunction, Request, Response } from 'express'
import * as usersService from '../services/users.service.js'
import type { CreateCashierInput, ResetPasswordInput } from '../schemas/users.schema.js'

export async function getMeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await usersService.getCurrentUser(req.user!.id, req.user!.shopId)
    res.status(200).json(profile)
  } catch (err) {
    next(err)
  }
}

export async function listCashiersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await usersService.listCashiers(req.user!.shopId))
  } catch (err) {
    next(err)
  }
}

export async function createCashierHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const cashier = await usersService.createCashier(req.body as CreateCashierInput, req.user!.id, req.user!.shopId)
    res.status(201).json(cashier)
  } catch (err) {
    next(err)
  }
}

export async function disableUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.disableUser(req.params.id as string, req.user!.id, req.user!.shopId)
    res.status(200).json(user)
  } catch (err) {
    next(err)
  }
}

export async function reactivateUserHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.reactivateUser(req.params.id as string, req.user!.id, req.user!.shopId)
    res.status(200).json(user)
  } catch (err) {
    next(err)
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { password } = req.body as ResetPasswordInput
    await usersService.resetPassword(req.params.id as string, password, req.user!.id, req.user!.shopId)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
