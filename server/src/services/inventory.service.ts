import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/AppError.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { recordAudit } from './audit.service.js'
import type { AdjustInventoryInput, UpdateReorderLevelInput } from '../schemas/inventory.schema.js'

export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK'
export type TxClient = Prisma.TransactionClient

const productSelect = { id: true, name: true, isActive: true } as const

function computeStatus(quantityOnHand: number, reorderLevel: number): StockStatus {
  if (quantityOnHand <= 0) return 'OUT_OF_STOCK'
  if (quantityOnHand <= reorderLevel) return 'LOW_STOCK'
  return 'IN_STOCK'
}

function withStatus<T extends { quantityOnHand: number; reorderLevel: number }>(item: T) {
  return { ...item, status: computeStatus(item.quantityOnHand, item.reorderLevel) }
}

function isIdempotencyKeyConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes('idempotencyKey')
  )
}

export async function listInventory() {
  const items = await prisma.inventoryItem.findMany({
    include: { product: { select: productSelect } },
    orderBy: { product: { name: 'asc' } },
  })
  return items.map(withStatus)
}

async function getInventoryItemByProductId(productId: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { productId },
    include: { product: { select: productSelect } },
  })
  if (!item) {
    throw AppError.notFound('Inventory record not found for this product')
  }
  return item
}

export async function getInventoryItem(productId: string) {
  return withStatus(await getInventoryItemByProductId(productId))
}

export async function updateReorderLevel(productId: string, data: UpdateReorderLevelInput) {
  // Ownership already verified by this read — productId is a global cuid,
  // so the plain-productId update immediately below is safe to trust.
  await getInventoryItemByProductId(productId)
  const updated = await prisma.inventoryItem.update({
    where: { productId },
    data: { reorderLevel: data.reorderLevel },
    include: { product: { select: productSelect } },
  })
  return withStatus(updated)
}

export async function getInventoryHistory(productId: string) {
  const item = await getInventoryItemByProductId(productId)
  return prisma.inventoryTransaction.findMany({
    where: { inventoryItemId: item.id },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { id: true, name: true } } },
  })
}

async function findByIdempotencyKey(inventoryItemId: string, idempotencyKey: string) {
  return prisma.inventoryTransaction.findUnique({
    where: { inventoryItemId_idempotencyKey: { inventoryItemId, idempotencyKey } },
  })
}

interface InventoryChange {
  type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'WASTE' | 'SALE'
  quantityChange: number
  reason?: string
  idempotencyKey?: string
}

// Core atomic step, reusable by anything that already holds a transaction
// client — currently `adjustInventory` below (admin stock adjustments) and
// checkout.service.ts (deducting stock for a sale as part of the larger
// checkout transaction). Callers are responsible for their own idempotency
// pre-check before opening a transaction, if they need one; this function
// itself is not idempotent — calling it twice always applies twice.
export async function applyInventoryChange(
  tx: TxClient,
  productId: string,
  change: InventoryChange,
  actingUserId: string,
) {
  // Atomic conditional decrement: the WHERE clause re-checks sufficient
  // stock in the same statement as the write, so two concurrent requests
  // can't both read "10 in stock" and both succeed in taking the last 5 —
  // the second one's UPDATE simply matches zero rows. (Only the negative
  // branch adds the stock-sufficiency condition; the positive branch has
  // nothing else that could make it match zero rows today, so count===0
  // there would indicate a real bug, not "insufficient stock".)
  const result = await tx.inventoryItem.updateMany({
    where: {
      productId,
      ...(change.quantityChange < 0 ? { quantityOnHand: { gte: -change.quantityChange } } : {}),
    },
    data: { quantityOnHand: { increment: change.quantityChange } },
  })

  if (result.count === 0) {
    throw AppError.conflict('Insufficient stock for this operation')
  }

  const updatedItem = await tx.inventoryItem.findUniqueOrThrow({ where: { productId } })

  const transaction = await tx.inventoryTransaction.create({
    data: omitUndefined({
      inventoryItemId: updatedItem.id,
      type: change.type,
      quantityChange: change.quantityChange,
      quantityAfter: updatedItem.quantityOnHand,
      reason: change.reason,
      idempotencyKey: change.idempotencyKey,
      createdByUserId: actingUserId,
    }),
  })

  return { transaction, item: updatedItem }
}

export async function adjustInventory(
  productId: string,
  input: AdjustInventoryInput,
  actingUserId: string,
) {
  const item = await getInventoryItemByProductId(productId)

  // Idempotent replay: a caller (e.g. a future checkout retry) that submits
  // the same idempotencyKey twice for the SAME product gets the original
  // result back instead of the stock being deducted a second time. Scoped
  // per inventory item — see the schema comment on why it's not global.
  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(item.id, input.idempotencyKey)
    if (existing) {
      return { transaction: existing, item: withStatus(item) }
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const { transaction, item: updatedItem } = await applyInventoryChange(
        tx,
        productId,
        omitUndefined(input),
        actingUserId,
      )

      await recordAudit(
        {
          actorId: actingUserId,
          action: 'INVENTORY_ADJUSTED',
          resource: 'InventoryItem',
          resourceId: updatedItem.id,
          previousState: { quantityOnHand: item.quantityOnHand },
          newState: { quantityOnHand: updatedItem.quantityOnHand, type: input.type, reason: input.reason },
        },
        tx,
      )

      return { transaction, item: withStatus({ ...updatedItem, product: item.product }) }
    })
  } catch (err) {
    // A concurrent request carrying the same idempotencyKey for this same
    // product won the race and committed first — this attempt's own stock
    // change was rolled back automatically when the transaction threw.
    // Return the winner's result rather than an error: the operation this
    // caller intended did happen, just via the other request.
    if (input.idempotencyKey && isIdempotencyKeyConflict(err)) {
      const winner = await findByIdempotencyKey(item.id, input.idempotencyKey)
      if (winner) {
        return { transaction: winner, item: withStatus(await getInventoryItemByProductId(productId)) }
      }
    }
    throw err
  }
}
