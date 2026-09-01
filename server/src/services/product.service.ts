import { Prisma, type Role } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/AppError.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { recordAudit } from './audit.service.js'
import type {
  CreateProductInput,
  CreateVariantInput,
  SetProductModifiersInput,
  UpdateProductInput,
  UpdateVariantInput,
} from '../schemas/product.schema.js'

// True for a unique-constraint violation. The only unique constraint that
// can fire from create/update on this model is the hand-written partial
// index on (productId, name) WHERE isActive — see discount.service.ts's
// isActiveNameConflict for the identical pattern. This is the DB-level
// backstop for assertVariantNameAvailable's check-then-write race.
function isActiveVariantNameConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

const productInclude = {
  category: true,
  variants: true,
  modifiers: { include: { modifier: true } },
} as const

export function listProducts(activeOnly: boolean, actingRole: Role) {
  // A CASHIER can only ever see active products, regardless of what
  // activeOnly value the request supplies — mirrors listDiscounts in
  // discount.service.ts. Without this, a cashier's POS screen (which never
  // passes activeOnly itself) would list every deactivated product too.
  const effectiveActiveOnly = actingRole === 'CASHIER' ? true : activeOnly
  return prisma.product.findMany({
    where: { ...(effectiveActiveOnly ? { isActive: true } : {}) },
    include: productInclude,
    orderBy: { name: 'asc' },
  })
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude })
  if (!product) {
    throw AppError.notFound('Product not found')
  }
  return product
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!category) {
    throw AppError.notFound('Category not found')
  }
}

export async function createProduct(data: CreateProductInput, actorId: string) {
  await assertCategoryExists(data.categoryId)
  // Every product gets an inventory record at creation, atomically, so it's
  // always ready for stock operations — there's no "product with no
  // inventory row" state to handle elsewhere.
  const created = await prisma.product.create({
    data: { ...omitUndefined(data), inventory: { create: {} } },
  })

  await recordAudit({
    actorId,
    action: 'PRODUCT_CREATED',
    resource: 'Product',
    resourceId: created.id,
    newState: { name: created.name, categoryId: created.categoryId, basePrice: created.basePrice },
  })

  return getProduct(created.id)
}

export async function updateProduct(id: string, data: UpdateProductInput, actorId: string) {
  const before = await getProduct(id)
  const changes = omitUndefined(data)
  if (changes.categoryId) {
    await assertCategoryExists(changes.categoryId)
  }
  await prisma.product.update({ where: { id }, data: changes })

  const changedFields = Object.keys(changes) as (keyof typeof changes)[]
  if (changedFields.length > 0) {
    await recordAudit({
      actorId,
      action: 'PRODUCT_UPDATED',
      resource: 'Product',
      resourceId: id,
      previousState: Object.fromEntries(changedFields.map((field) => [field, before[field]])),
      newState: changes,
    })
  }

  // basePrice changes get their own dedicated audit action, in addition to
  // the general PRODUCT_UPDATED entry above — price is the one field
  // sensitive enough to want its own filterable trail.
  if (typeof changes.basePrice === 'number' && changes.basePrice !== before.basePrice) {
    await recordAudit({
      actorId,
      action: 'PRICE_CHANGED',
      resource: 'Product',
      resourceId: id,
      previousState: { basePrice: before.basePrice },
      newState: { basePrice: changes.basePrice },
    })
  }

  return getProduct(id)
}

// A hard delete is only safe when nothing historical points at this product.
// Once an OrderItem snapshots it, deleting the row would break that order's
// (and any report's) ability to display what was actually sold — deactivate
// is the correct action from that point on, so this stays a 409, not a 404.
export async function deleteProduct(id: string): Promise<void> {
  await assertProductExists(id)

  const orderItemCount = await prisma.orderItem.count({ where: { productId: id } })
  if (orderItemCount > 0) {
    throw AppError.conflict('This product has order history and cannot be deleted. Deactivate it instead.')
  }

  await prisma.$transaction(async (tx) => {
    // ProductVariant/InventoryItem/InventoryTransaction all use
    // onDelete: Restrict (unlike ProductModifier, which cascades), so they
    // must be cleared first, deepest dependency first. This only runs once
    // the order-history guard above has confirmed the product was never
    // sold, so its inventory adjustment log is internal bookkeeping with no
    // remaining product to describe — safe to discard alongside it.
    await tx.productVariant.deleteMany({ where: { productId: id } })
    await tx.inventoryTransaction.deleteMany({ where: { inventoryItem: { productId: id } } })
    await tx.inventoryItem.deleteMany({ where: { productId: id } })
    await tx.product.delete({ where: { id } })
  })
}

async function assertProductExists(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    throw AppError.notFound('Product not found')
  }
}

async function assertVariantNameAvailable(productId: string, name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.productVariant.findFirst({
    where: { productId, name, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  })
  if (existing) {
    throw AppError.conflict(`An active variant named "${name}" already exists for this product`)
  }
}

export async function createVariant(productId: string, data: CreateVariantInput) {
  await assertProductExists(productId)
  await assertVariantNameAvailable(productId, data.name)
  try {
    return await prisma.productVariant.create({ data: { ...data, productId } })
  } catch (err) {
    if (isActiveVariantNameConflict(err)) {
      throw AppError.conflict(`An active variant named "${data.name}" already exists for this product`)
    }
    throw err
  }
}

export async function updateVariant(productId: string, variantId: string, data: UpdateVariantInput) {
  await assertProductExists(productId)

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } })
  if (!variant || variant.productId !== productId) {
    throw AppError.notFound('Variant not found')
  }
  if (data.name) {
    await assertVariantNameAvailable(productId, data.name, variantId)
  }
  try {
    return await prisma.productVariant.update({ where: { id: variantId }, data: omitUndefined(data) })
  } catch (err) {
    if (isActiveVariantNameConflict(err)) {
      // Reached even for a patch that never touched `name` (e.g. just
      // `{ isActive: true }`) — reactivating this variant collides with a
      // different, currently-active variant on the same product that
      // already has this name.
      throw AppError.conflict(
        `An active variant named "${data.name ?? variant.name}" already exists for this product`,
      )
    }
    throw err
  }
}

export async function setProductModifiers(productId: string, { modifierIds }: SetProductModifiersInput) {
  await assertProductExists(productId)

  if (modifierIds.length > 0) {
    const matchCount = await prisma.modifier.count({ where: { id: { in: modifierIds } } })
    if (matchCount !== new Set(modifierIds).size) {
      throw AppError.badRequest('One or more modifierIds do not exist')
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.productModifier.deleteMany({ where: { productId } })
    if (modifierIds.length > 0) {
      await tx.productModifier.createMany({ data: modifierIds.map((modifierId) => ({ productId, modifierId })) })
    }
  })

  return getProduct(productId)
}
