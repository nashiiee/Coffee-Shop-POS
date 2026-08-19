import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { getMeHandler } from '../controllers/users.controller.js'

export const usersRouter = Router()

usersRouter.get('/me', authenticate, getMeHandler)
