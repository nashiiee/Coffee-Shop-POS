import { prisma } from '../lib/prisma.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { AppError } from '../lib/AppError.js'
import { recordAudit } from './audit.service.js'
import type { CreateModifierInput, UpdateModifierInput } from '../schemas/modifier.schema.js'

export function listModifiers(activeOnly: boolean) {
  return prisma.modifier.findMany({
    ...(activeOnly ? { where: { isActive: true } } : {}),
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
  return prisma.modifier.create({ data })
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
  const updated = await prisma.modifier.update({ where: { id }, data: changes })

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
