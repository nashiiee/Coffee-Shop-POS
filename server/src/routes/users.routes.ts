import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { getMeHandler } from '../controllers/users.controller.js'

export const usersRouter = Router()

usersRouter.get('/me', ...requireAuth(), getMeHandler)
