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

export function listProducts(activeOnly: boolean, actingRole: Role, shopId: string) {
  // A CASHIER can only ever see active products, regardless of what
  // activeOnly value the request supplies — mirrors listDiscounts in
  // discount.service.ts. Without this, a cashier's POS screen (which never
  // passes activeOnly itself) would list every deactivated product too.
  const effectiveActiveOnly = actingRole === 'CASHIER' ? true : activeOnly
  return prisma.product.findMany({
    where: { shopId, ...(effectiveActiveOnly ? { isActive: true } : {}) },
    include: productInclude,
    orderBy: { name: 'asc' },
  })
}

export async function getProduct(id: string, shopId: string) {
  const product = await prisma.product.findUnique({ where: { id, shopId }, include: productInclude })
  if (!product) {
    throw AppError.notFound('Product not found')
  }
  return product
}

// Without this, a shop could point a product at another shop's category —
// categoryId is a plain FK with no compound (categoryId, shopId) constraint
// at the DB level, so this ownership check is the only thing enforcing it.
// Mirrors category.service.ts's assertValidParent.
async function assertCategoryOwnership(categoryId: string, shopId: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId, shopId } })
  if (!category) {
    throw AppError.notFound('Category not found')
  }
}

export async function createProduct(data: CreateProductInput, actorId: string, shopId: string) {
  await assertCategoryOwnership(data.categoryId, shopId)
  // Every product gets an inventory record at creation, atomically, so it's
  // always ready for stock operations — there's no "product with no
  // inventory row" state to handle elsewhere.
  const created = await prisma.product.create({
    data: { ...omitUndefined(data), shopId, inventory: { create: {} } },
  })

  await recordAudit({
    shopId,
    actorId,
    action: 'PRODUCT_CREATED',
    resource: 'Product',
    resourceId: created.id,
    newState: { name: created.name, categoryId: created.categoryId, basePrice: created.basePrice },
  })

  return getProduct(created.id, shopId)
}

export async function updateProduct(id: string, data: UpdateProductInput, actorId: string, shopId: string) {
  const before = await getProduct(id, shopId)
  const changes = omitUndefined(data)
  if (changes.categoryId) {
    await assertCategoryOwnership(changes.categoryId, shopId)
  }
  await prisma.product.update({ where: { id, shopId }, data: changes })

  const changedFields = Object.keys(changes) as (keyof typeof changes)[]
  if (changedFields.length > 0) {
    await recordAudit({
      shopId,
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
      shopId,
      actorId,
      action: 'PRICE_CHANGED',
      resource: 'Product',
      resourceId: id,
      previousState: { basePrice: before.basePrice },
      newState: { basePrice: changes.basePrice },
    })
  }

  return getProduct(id, shopId)
}

// A hard delete is only safe when nothing historical points at this product.
// Once an OrderItem snapshots it, deleting the row would break that order's
// (and any report's) ability to display what was actually sold — deactivate
// is the correct action from that point on, so this stays a 409, not a 404.
export async function deleteProduct(id: string, shopId: string): Promise<void> {
  await assertProductExists(id, shopId)

  // productId alone is sufficient here — id was already verified above to
  // belong to shopId, and a product belongs to exactly one shop, so any
  // OrderItem referencing it is necessarily that same shop's history.
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
    await tx.product.delete({ where: { id, shopId } })
  })
}

async function assertProductExists(productId: string, shopId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId, shopId } })
  if (!product) {
    throw AppError.notFound('Product not found')
  }
}

// ProductVariant carries no shopId column of its own — it is only ever
// reachable through its parent Product, which the caller has already
// shop-scoped via assertProductExists. productId is a global cuid, so once
// the parent lookup has confirmed ownership, scoping variant queries by
// productId alone is safe.
async function assertVariantNameAvailable(productId: string, name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.productVariant.findFirst({
    where: { productId, name, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  })
  if (existing) {
    throw AppError.conflict(`An active variant named "${name}" already exists for this product`)
  }
}

export async function createVariant(productId: string, data: CreateVariantInput, shopId: string) {
  await assertProductExists(productId, shopId)
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

export async function updateVariant(productId: string, variantId: string, data: UpdateVariantInput, shopId: string) {
  // Shop-scope the parent Product first — ProductVariant has no shopId of
  // its own, so this is the only choke point that stops a shop from
  // touching another shop's variant by guessing a variantId.
  await assertProductExists(productId, shopId)

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

export async function setProductModifiers(productId: string, { modifierIds }: SetProductModifiersInput, shopId: string) {
  await assertProductExists(productId, shopId)

  if (modifierIds.length > 0) {
    // shopId scoped so a shop can never attach another shop's modifier ids
    // to its own product.
    const matchCount = await prisma.modifier.count({ where: { id: { in: modifierIds }, shopId } })
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

  return getProduct(productId, shopId)
}
