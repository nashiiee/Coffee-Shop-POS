import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/AppError.js'
import { hashPassword } from '../lib/password.js'
import { recordAudit } from './audit.service.js'
import type { Role } from '@prisma/client'
import type { CreateCashierInput } from '../schemas/users.schema.js'

export interface UserProfileDTO {
  id: string
  name: string
  email: string
  role: Role
}

export interface CashierDTO {
  id: string
  name: string
  email: string
  isActive: boolean
  createdAt: Date
}

const cashierSelect = { id: true, name: true, email: true, isActive: true, createdAt: true } as const

export async function getCurrentUser(id: string, shopId: string): Promise<UserProfileDTO> {
  const user = await prisma.user.findUnique({ where: { id, shopId } })
  if (!user || !user.isActive) {
    throw AppError.unauthorized('Account no longer active')
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

export function listCashiers(shopId: string): Promise<CashierDTO[]> {
  return prisma.user.findMany({
    where: { role: 'CASHIER', shopId },
    select: cashierSelect,
    orderBy: { name: 'asc' },
  })
}

export async function createCashier(data: CreateCashierInput, actorId: string, shopId: string): Promise<CashierDTO> {
  const passwordHash = await hashPassword(data.password)
  const created = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash, role: 'CASHIER', shopId },
    select: cashierSelect,
  })

  await recordAudit({
    shopId,
    actorId,
    action: 'USER_CREATED',
    resource: 'User',
    resourceId: created.id,
    newState: { name: created.name, email: created.email, role: 'CASHIER' },
  })

  return created
}

async function getUserOrThrow(id: string, shopId: string) {
  const user = await prisma.user.findUnique({ where: { id, shopId } })
  if (!user) {
    throw AppError.notFound('User not found')
  }
  return user
}

export async function disableUser(id: string, actorId: string, shopId: string): Promise<CashierDTO> {
  if (id === actorId) {
    throw AppError.badRequest('You cannot disable your own account')
  }

  const user = await getUserOrThrow(id, shopId)

  if (!user.isActive) {
    return { id: user.id, name: user.name, email: user.email, isActive: user.isActive, createdAt: user.createdAt }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (user.role === 'ADMIN') {
      // Locks every currently-active-admin row *for this shop* for the rest
      // of this transaction. A concurrent disableUser call targeting a
      // *different* admin in the same shop blocks on this same
      // SELECT ... FOR UPDATE instead of both transactions reading the same
      // pre-update count and both passing the <=1 guard — the race that
      // would leave zero active admins. The shopId filter is required, not
      // optional: without it this count is taken across every shop on the
      // platform, so Shop A with exactly one admin could have its guard
      // pass because some unrelated Shop B happens to have several active
      // admins — permanently locking Shop A out with no admin left to
      // re-enable anyone.
      const lockedActiveAdmins = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" = true AND "shopId" = ${shopId} FOR UPDATE
      `
      if (lockedActiveAdmins.length <= 1) {
        throw AppError.badRequest('Cannot disable the only active admin account')
      }
    }
    return tx.user.update({ where: { id, shopId }, data: { isActive: false }, select: cashierSelect })
  })

  await recordAudit({
    shopId,
    actorId,
    action: 'USER_DISABLED',
    resource: 'User',
    resourceId: id,
    previousState: { isActive: true },
    newState: { isActive: false },
  })

  return updated
}

export async function reactivateUser(id: string, actorId: string, shopId: string): Promise<CashierDTO> {
  const user = await getUserOrThrow(id, shopId)

  if (user.isActive) {
    return { id: user.id, name: user.name, email: user.email, isActive: user.isActive, createdAt: user.createdAt }
  }

  const updated = await prisma.user.update({ where: { id, shopId }, data: { isActive: true }, select: cashierSelect })

  await recordAudit({
    shopId,
    actorId,
    action: 'USER_REACTIVATED',
    resource: 'User',
    resourceId: id,
    previousState: { isActive: false },
    newState: { isActive: true },
  })

  return updated
}

export async function resetPassword(id: string, newPassword: string, actorId: string, shopId: string): Promise<void> {
  await getUserOrThrow(id, shopId)
  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({ where: { id, shopId }, data: { passwordHash } })

  // Never record the plaintext or hash in previousState/newState — the
  // audit trail confirms a reset happened and who did it, not what the
  // password is or was.
  await recordAudit({
    shopId,
    actorId,
    action: 'USER_PASSWORD_RESET',
    resource: 'User',
    resourceId: id,
  })
}
