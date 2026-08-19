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

const productInclude = {
  category: true,
  variants: true,
  modifiers: { include: { modifier: true } },
} as const

export function listProducts(activeOnly: boolean) {
  return prisma.product.findMany({
    ...(activeOnly ? { where: { isActive: true } } : {}),
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

export async function createProduct(data: CreateProductInput, actorId: string) {
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
  return prisma.productVariant.create({ data: { ...data, productId } })
}

export async function updateVariant(productId: string, variantId: string, data: UpdateVariantInput) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } })
  if (!variant || variant.productId !== productId) {
    throw AppError.notFound('Variant not found')
  }
  if (data.name) {
    await assertVariantNameAvailable(productId, data.name, variantId)
  }
  return prisma.productVariant.update({ where: { id: variantId }, data: omitUndefined(data) })
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
