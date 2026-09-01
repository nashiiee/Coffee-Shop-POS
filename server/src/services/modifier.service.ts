import { Prisma, type Role } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { AppError } from '../lib/AppError.js'
import { recordAudit } from './audit.service.js'
import type { CreateModifierInput, UpdateModifierInput } from '../schemas/modifier.schema.js'

// True for a unique-constraint violation. The only unique constraint that
// can fire from create/update on this model is the hand-written partial
// index on (name) WHERE isActive — see discount.service.ts's
// isActiveNameConflict for the identical pattern. This is the DB-level
// backstop for assertNameAvailable's check-then-write race.
function isActiveNameConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export function listModifiers(activeOnly: boolean, actingRole: Role) {
  // A CASHIER can only ever see active modifiers, regardless of what
  // activeOnly value the request supplies — mirrors listDiscounts in
  // discount.service.ts. Without this, a cashier's POS screen (which never
  // passes activeOnly itself) would list every deactivated modifier too.
  const effectiveActiveOnly = actingRole === 'CASHIER' ? true : activeOnly
  return prisma.modifier.findMany({
    where: { ...(effectiveActiveOnly ? { isActive: true } : {}) },
    orderBy: { name: 'asc' },
  })
}

async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.modifier.findFirst({
    where: { name, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  })
  if (existing) {
    throw AppError.conflict(`An active modifier named "${name}" already exists`)
  }
}

// Creation is intentionally not audited — see the matching note on
// createCategory in category.service.ts.
export async function createModifier(data: CreateModifierInput) {
  await assertNameAvailable(data.name)
  try {
    return await prisma.modifier.create({ data })
  } catch (err) {
    if (isActiveNameConflict(err)) {
      throw AppError.conflict(`An active modifier named "${data.name}" already exists`)
    }
    throw err
  }
}

export async function updateModifier(id: string, data: UpdateModifierInput, actorId: string) {
  if (data.name) {
    await assertNameAvailable(data.name, id)
  }
  const current = await prisma.modifier.findUnique({ where: { id } })
  if (!current) {
    throw AppError.notFound('Modifier not found')
  }
  const changes = omitUndefined(data)

  let updated
  try {
    updated = await prisma.modifier.update({ where: { id }, data: changes })
  } catch (err) {
    if (isActiveNameConflict(err)) {
      // Reached even for a patch that never touched `name` (e.g. just
      // `{ isActive: true }`) — reactivating this modifier collides with a
      // different, currently-active modifier that already has this name.
      throw AppError.conflict(`An active modifier named "${data.name ?? current.name}" already exists`)
    }
    throw err
  }

  const changedFields = Object.keys(changes) as (keyof typeof changes)[]
  if (changedFields.length > 0) {
    await recordAudit({
      actorId,
      action: 'CONFIG_CHANGED',
      resource: 'Modifier',
      resourceId: id,
      previousState: Object.fromEntries(changedFields.map((field) => [field, current[field]])),
      newState: changes,
    })
  }

  return updated
}
