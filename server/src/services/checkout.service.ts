import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/AppError.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { applyInventoryChange } from './inventory.service.js'
import { calcDiscountAmount, calcLineSubtotal, calcTotal, validateCashPayment } from './checkoutCalculations.js'
import type { CheckoutInput, CheckoutItemInput } from '../schemas/checkout.schema.js'

export const orderInclude = {
  cashier: { select: { id: true, name: true } },
  discount: true,
  items: { include: { modifiers: true } },
  payment: true,
} as const

function formatPeso(cents: number): string {
  return `₱${(cents / 100).toFixed(2)}`
}

function isIdempotencyKeyConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes('idempotencyKey')
  )
}

interface ResolvedItem {
  productId: string
  productName: string
  variantName: string | null
  unitPrice: number
  quantity: number
  modifiers: { name: string; price: number }[]
  lineSubtotal: number
}

// Re-derives every price from the live catalog inside the transaction — the
// request only ever supplies productId/variantId/modifierIds/quantity (see
// checkout.schema.ts). Never reads a price, subtotal, or total from `input`.
async function resolveItem(tx: Prisma.TransactionClient, cartItem: CheckoutItemInput): Promise<ResolvedItem> {
  const product = await tx.product.findUnique({
    where: { id: cartItem.productId },
    include: { variants: true, modifiers: { include: { modifier: true } } },
  })
  if (!product || !product.isActive) {
    throw AppError.badRequest(`Product is not available for purchase`)
  }

  const activeVariants = product.variants.filter((v) => v.isActive)
  let unitPrice = product.basePrice
  let variantName: string | null = null

  if (cartItem.variantId) {
    // Validated whenever a variantId is sent, regardless of how many
    // active variants the product currently has — a client-supplied
    // variantId that doesn't resolve to a currently-active variant must
    // never be silently ignored in favor of basePrice.
    const variant = activeVariants.find((v) => v.id === cartItem.variantId)
    if (!variant) {
      throw AppError.badRequest(`Selected variant is not available for ${product.name}`)
    }
    unitPrice = variant.price
    variantName = variant.name
  } else if (activeVariants.length > 0) {
    throw AppError.badRequest(`A size/variant selection is required for ${product.name}`)
  }

  const uniqueModifierIds = Array.from(new Set(cartItem.modifierIds))
  const modifiers = uniqueModifierIds.map((modifierId) => {
    const link = product.modifiers.find((m) => m.modifierId === modifierId && m.modifier.isActive)
    if (!link) {
      throw AppError.badRequest(`Selected add-on is not available for ${product.name}`)
    }
    return { name: link.modifier.name, price: link.modifier.price }
  })

  const lineSubtotal = calcLineSubtotal({
    unitPrice,
    modifierPrices: modifiers.map((m) => m.price),
    quantity: cartItem.quantity,
  })

  return {
    productId: product.id,
    productName: product.name,
    variantName,
    unitPrice,
    quantity: cartItem.quantity,
    modifiers,
    lineSubtotal,
  }
}

async function findByIdempotencyKey(idempotencyKey: string) {
  return prisma.order.findUnique({ where: { idempotencyKey }, include: orderInclude })
}

export async function checkout(input: CheckoutInput, cashierId: string) {
  // Cheap pre-check outside any transaction: a plain retry (no concurrent
  // race) short-circuits immediately without touching pricing/inventory.
  const existing = await findByIdempotencyKey(input.idempotencyKey)
  if (existing) {
    return existing
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const resolvedItems: ResolvedItem[] = []
      let subtotal = 0
      for (const cartItem of input.items) {
        const resolved = await resolveItem(tx, cartItem)
        resolvedItems.push(resolved)
        subtotal += resolved.lineSubtotal
      }

      let discount: { id: string; name: string; type: 'PERCENTAGE' | 'FIXED'; value: number } | null = null
      if (input.discountId) {
        const found = await tx.discount.findUnique({ where: { id: input.discountId } })
        if (!found || !found.isActive) {
          throw AppError.badRequest('Selected discount is not available')
        }
        // Re-checked here, not just filtered out of the dropdown — a
        // discount can expire in the window between the cashier opening
        // checkout and confirming payment, and the frontend's discountId is
        // never trusted as proof of current validity.
        if (found.expiresAt && found.expiresAt < new Date()) {
          throw AppError.badRequest('Selected discount has expired')
        }
        discount = found
      }

      const discountAmount = calcDiscountAmount(subtotal, discount)
      const total = calcTotal(subtotal, discountAmount)

      const payment = validateCashPayment(total, input.amountReceived)
      if (!payment.isValid) {
        throw AppError.badRequest(`Insufficient payment: ${formatPeso(payment.shortfall)} remaining`)
      }

      const createdOrder = await tx.order.create({
        data: omitUndefined({
          cashierId,
          subtotal,
          discountId: discount?.id,
          discountNameSnapshot: discount?.name,
          discountAmount,
          total,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
        }),
      })

      for (const item of resolvedItems) {
        const orderItem = await tx.orderItem.create({
          data: omitUndefined({
            orderId: createdOrder.id,
            productId: item.productId,
            productNameSnapshot: item.productName,
            variantNameSnapshot: item.variantName,
            unitPriceSnapshot: item.unitPrice,
            quantity: item.quantity,
            lineSubtotal: item.lineSubtotal,
          }),
        })

        if (item.modifiers.length > 0) {
          await tx.orderItemModifier.createMany({
            data: item.modifiers.map((m) => ({
              orderItemId: orderItem.id,
              modifierNameSnapshot: m.name,
              priceSnapshot: m.price,
            })),
          })
        }

        // Insufficient stock throws here, which rolls back this entire
        // transaction — the order, its items, and any prior items' already-
        // "deducted" inventory in this same transaction are all undone. No
        // partial order and no partial deduction can ever be persisted.
        //
        // Deliberately NOT passing an idempotencyKey here: retry-safety for
        // the whole checkout is already provided by the order-level
        // idempotencyKey check above (findByIdempotencyKey), which
        // short-circuits before any of this runs. A per-item key scoped by
        // productId alone would collide whenever one order has two lines
        // for the same product (e.g. a Small Latte + a Large Latte), since
        // InventoryItem is one row per product, not per variant — that
        // collision would wrongly roll back a perfectly valid order.
        await applyInventoryChange(
          tx,
          item.productId,
          {
            type: 'SALE',
            quantityChange: -item.quantity,
            reason: `Order #${createdOrder.sequenceNumber}`,
          },
          cashierId,
        )
      }

      await tx.payment.create({
        data: {
          orderId: createdOrder.id,
          method: 'CASH',
          amountDue: total,
          amountReceived: input.amountReceived,
          changeGiven: payment.changeGiven,
        },
      })

      return tx.order.findUniqueOrThrow({ where: { id: createdOrder.id }, include: orderInclude })
    })

    return order
  } catch (err) {
    // A concurrent request with the same idempotencyKey won the race and
    // committed first — this attempt's own writes were rolled back. Return
    // the winner's order rather than an error: checkout that the cashier
    // intended did happen, just via the other request.
    if (isIdempotencyKeyConflict(err)) {
      const winner = await findByIdempotencyKey(input.idempotencyKey)
      if (winner) {
        return winner
      }
    }
    throw err
  }
}
