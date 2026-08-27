import { Prisma, type Role } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { omitUndefined } from '../lib/omitUndefined.js'
import { AppError } from '../lib/AppError.js'
import { recordAudit } from './audit.service.js'
import type { CreateDiscountInput, UpdateDiscountInput } from '../schemas/discount.schema.js'

// True for a unique-constraint violation. The only unique constraint that
// can fire from create/update on this model is the hand-written partial
// index on (name) WHERE isActive — Discount's other unique-ish field, id,
// is always a freshly generated cuid and never collides in practice. This
// is the DB-level backstop for assertNameAvailable's check-then-write
// race, and the only guard at all for the isActive-only-patch reactivation
// path (see updateDiscount below) — that path never calls
// assertNameAvailable since it doesn't touch `name`.
function isActiveNameConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export function listDiscounts(activeOnly: boolean, actingRole: Role, shopId: string) {
  // A CASHIER can only ever see currently-usable discounts, regardless of
  // what activeOnly value the request supplies — the query param is a
  // client-controlled convenience for the ADMIN management UI, not an
  // access-control boundary. Without this, a cashier hitting the API
  // directly (bypassing the frontend's own activeOnly=true call) could see
  // every inactive/expired/future-dated discount in the system.
  const effectiveActiveOnly = actingRole === 'CASHIER' ? true : activeOnly
  return prisma.discount.findMany({
    where: {
      shopId,
      // activeOnly backs the cashier-facing checkout dropdown — a discount
      // that's still marked isActive but has already expired must not be
      // offered as a choice, even though checkout would reject it anyway if
      // one were somehow selected.
      ...(effectiveActiveOnly
        ? { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] }
        : {}),
    },
    orderBy: { name: 'asc' },
  })
}

async function assertNameAvailable(name: string, shopId: string, excludeId?: string): Promise<void> {
  const existing = await prisma.discount.findFirst({
    where: { name, shopId, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  })
  if (existing) {
    throw AppError.conflict(`An active discount named "${name}" already exists`)
  }
}

export async function createDiscount(data: CreateDiscountInput, actorId: string, shopId: string) {
  await assertNameAvailable(data.name, shopId)
  try {
    const created = await prisma.discount.create({ data: { ...omitUndefined(data), shopId } })
    await recordAudit({
      shopId,
      actorId,
      action: 'DISCOUNT_CREATED',
      resource: 'Discount',
      resourceId: created.id,
      newState: { name: created.name, type: created.type, value: created.value },
    })
    return created
  } catch (err) {
    if (isActiveNameConflict(err)) {
      throw AppError.conflict(`An active discount named "${data.name}" already exists`)
    }
    throw err
  }
}

export async function updateDiscount(id: string, data: UpdateDiscountInput, actorId: string, shopId: string) {
  if (data.name) {
    await assertNameAvailable(data.name, shopId, id)
  }

  // The schema's own refine() only validates value<=100 when BOTH `type`
  // and `value` appear in the SAME patch — a lone `{ value: 500 }` on an
  // existing PERCENTAGE discount would skip that check entirely. Re-check
  // against the MERGED (existing + patch) state here, since that's what
  // actually ends up persisted and later feeds checkout's discount math.
  const current = await prisma.discount.findUnique({ where: { id, shopId } })
  if (!current) {
    throw AppError.notFound('Discount not found')
  }
  const effectiveType = data.type ?? current.type
  const effectiveValue = data.value ?? current.value
  if (effectiveType === 'PERCENTAGE' && effectiveValue > 100) {
    throw AppError.badRequest('A percentage discount value cannot exceed 100')
  }

  try {
    const changes = omitUndefined(data)
    const updated = await prisma.discount.update({ where: { id, shopId }, data: changes })
    const changedFields = Object.keys(changes) as (keyof typeof changes)[]
    if (changedFields.length > 0) {
      await recordAudit({
        shopId,
        actorId,
        action: 'DISCOUNT_UPDATED',
        resource: 'Discount',
        resourceId: id,
        previousState: Object.fromEntries(changedFields.map((field) => [field, current[field]])),
        newState: changes,
      })
    }
    return updated
  } catch (err) {
    if (isActiveNameConflict(err)) {
      // Reached even for a patch that never touched `name` (e.g. just
      // `{ isActive: true }`) — reactivating this discount collides with a
      // different, currently-active discount that already has this name.
      throw AppError.conflict(`An active discount named "${data.name ?? current.name}" already exists`)
    }
    throw err
  }
}
