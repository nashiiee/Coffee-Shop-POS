import { prisma } from '../lib/prisma.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { AppError } from '../lib/AppError.js'
import { recordAudit } from './audit.service.js'
import type { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js'

export function listCategories(activeOnly: boolean) {
  return prisma.category.findMany({
    ...(activeOnly ? { where: { isActive: true } } : {}),
    orderBy: { sortOrder: 'asc' },
  })
}

async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.category.findFirst({
    where: { name, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  })
  if (existing) {
    throw AppError.conflict(`An active category named "${name}" already exists`)
  }
}

// Creation is intentionally not audited — only isActive/name changes via
// updateCategory are, under CONFIG_CHANGED (see below). A newly-created,
// unused category carries no history worth logging; the "important
// configuration change" is deactivating/renaming one already in use.
export async function createCategory(data: CreateCategoryInput) {
  await assertNameAvailable(data.name)
  return prisma.category.create({ data })
}

export async function updateCategory(id: string, data: UpdateCategoryInput, actorId: string) {
  if (data.name) {
    await assertNameAvailable(data.name, id)
  }
  const current = await prisma.category.findUnique({ where: { id } })
  if (!current) {
    throw AppError.notFound('Category not found')
  }
  const changes = omitUndefined(data)
  const updated = await prisma.category.update({ where: { id }, data: changes })

  const changedFields = Object.keys(changes) as (keyof typeof changes)[]
  if (changedFields.length > 0) {
    await recordAudit({
      actorId,
      action: 'CONFIG_CHANGED',
      resource: 'Category',
      resourceId: id,
      previousState: Object.fromEntries(changedFields.map((field) => [field, current[field]])),
      newState: changes,
    })
  }

  return updated
}
