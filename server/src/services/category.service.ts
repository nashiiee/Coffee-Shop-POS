import { Prisma, type Role } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { AppError } from '../lib/AppError.js'
import { recordAudit } from './audit.service.js'
import type { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema.js'

// True for a unique-constraint violation. The only unique constraint that
// can fire from create/update on this model is the hand-written partial
// index on (name) WHERE isActive — see discount.service.ts's
// isActiveNameConflict for the identical pattern. This is the DB-level
// backstop for assertNameAvailable's check-then-write race.
function isActiveNameConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export function listCategories(activeOnly: boolean, actingRole: Role, shopId: string) {
  // A CASHIER can only ever see active categories, regardless of what
  // activeOnly value the request supplies — mirrors listDiscounts in
  // discount.service.ts. Without this, a cashier's POS screen (which never
  // passes activeOnly itself) would list every deactivated category too.
  const effectiveActiveOnly = actingRole === 'CASHIER' ? true : activeOnly
  return prisma.category.findMany({
    where: { shopId, ...(effectiveActiveOnly ? { isActive: true } : {}) },
    orderBy: { sortOrder: 'asc' },
  })
}

async function assertNameAvailable(name: string, shopId: string, excludeId?: string): Promise<void> {
  const existing = await prisma.category.findFirst({
    where: { name, shopId, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  })
  if (existing) {
    throw AppError.conflict(`An active category named "${name}" already exists`)
  }
}

// Only one level of nesting is supported — a sub-category's own parent must
// itself be top-level, so the UI never has to render a third tier.
async function assertValidParent(parentId: string, shopId: string, ownId?: string): Promise<void> {
  if (parentId === ownId) {
    throw AppError.badRequest('A category cannot be its own parent')
  }
  // shopId scoped so a shop can never nest under another shop's category.
  const parent = await prisma.category.findUnique({ where: { id: parentId, shopId } })
  if (!parent) {
    throw AppError.notFound('Parent category not found')
  }
  if (parent.parentId) {
    throw AppError.badRequest('A sub-category cannot itself have a parent')
  }
}

// Creation is intentionally not audited — only isActive/name changes via
// updateCategory are, under CONFIG_CHANGED (see below). A newly-created,
// unused category carries no history worth logging; the "important
// configuration change" is deactivating/renaming one already in use.
export async function createCategory(data: CreateCategoryInput, shopId: string) {
  await assertNameAvailable(data.name, shopId)
  if (data.parentId) {
    await assertValidParent(data.parentId, shopId)
  }
  try {
    return await prisma.category.create({
      data: { shopId, name: data.name, sortOrder: data.sortOrder, parentId: data.parentId ?? null },
    })
  } catch (err) {
    if (isActiveNameConflict(err)) {
      throw AppError.conflict(`An active category named "${data.name}" already exists`)
    }
    throw err
  }
}

export async function updateCategory(id: string, data: UpdateCategoryInput, actorId: string, shopId: string) {
  if (data.name) {
    await assertNameAvailable(data.name, shopId, id)
  }
  if (data.parentId) {
    await assertValidParent(data.parentId, shopId, id)
  }
  const current = await prisma.category.findUnique({ where: { id, shopId } })
  if (!current) {
    throw AppError.notFound('Category not found')
  }
  const changes = omitUndefined(data)

  let updated
  try {
    updated = await prisma.category.update({ where: { id, shopId }, data: changes })
  } catch (err) {
    if (isActiveNameConflict(err)) {
      // Reached even for a patch that never touched `name` (e.g. just
      // `{ isActive: true }`) — reactivating this category collides with a
      // different, currently-active category that already has this name.
      throw AppError.conflict(`An active category named "${data.name ?? current.name}" already exists`)
    }
    throw err
  }

  const changedFields = Object.keys(changes) as (keyof typeof changes)[]
  if (changedFields.length > 0) {
    await recordAudit({
      shopId,
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
