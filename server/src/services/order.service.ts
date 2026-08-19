import type { Prisma, Role } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/AppError.js'
import { orderInclude } from './checkout.service.js'
import type { ListOrdersQuery } from '../schemas/order.schema.js'

const orderListSelect = {
  id: true,
  sequenceNumber: true,
  status: true,
  subtotal: true,
  discountAmount: true,
  total: true,
  createdAt: true,
  cashier: { select: { id: true, name: true } },
  payment: { select: { method: true } },
  _count: { select: { items: true } },
} as const

interface ActingUser {
  id: string
  role: Role
}

// CASHIER is always restricted to their own orders — a `cashierId` filter
// value coming from the request is only ever honored for ADMIN. This is
// enforced here (not just hidden in the UI) so a cashier can never see
// another cashier's order history by crafting the request directly.
function buildWhere(filters: ListOrdersQuery, actingUser: ActingUser): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {}

  if (actingUser.role === 'CASHIER') {
    where.cashierId = actingUser.id
  } else if (filters.cashierId) {
    where.cashierId = filters.cashierId
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.paymentMethod) {
    where.payment = { method: filters.paymentMethod }
  }

  if (filters.dateFrom || filters.dateTo) {
    // dateTo arrives as midnight UTC of the selected day (from an
    // <input type="date">, coerced by zod) — used as-is, `lte` would
    // exclude every order placed after 00:00:00 on that day, silently
    // dropping almost the entire "to" date from an inclusive-looking
    // range. Push it to the last millisecond of that day instead.
    const endOfDateTo = filters.dateTo ? new Date(filters.dateTo.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(endOfDateTo ? { lte: endOfDateTo } : {}),
    }
  }

  if (filters.search) {
    // Only treat the search as an order-number lookup when it's PURELY
    // digits (optionally "#"-prefixed, matching the receipt's "#000007"
    // display) — checking for "contains any digit" would silently misroute
    // a name like "Anna2" into a sequenceNumber search and drop the name
    // match entirely.
    const numericMatch = /^#?(\d+)$/.exec(filters.search.trim())
    if (numericMatch) {
      const parsed = Number(numericMatch[1])
      // sequenceNumber is a Postgres Int (max 2^31-1) — an out-of-range
      // search string can never match a real order. Use a sentinel that
      // matches nothing instead of handing Prisma a value that would
      // throw a DB-level error rather than returning an empty result set.
      where.sequenceNumber = Number.isSafeInteger(parsed) && parsed <= 2147483647 ? parsed : -1
    } else {
      // Falls back to matching the cashier's name — useful for an admin
      // scanning history without knowing an order number. Cashiers already
      // only see their own orders regardless.
      where.cashier = { name: { contains: filters.search, mode: 'insensitive' } }
    }
  }

  return where
}

function resolveOrderBy(sortBy: ListOrdersQuery['sortBy']): Prisma.OrderOrderByWithRelationInput {
  switch (sortBy) {
    case 'oldest':
      return { createdAt: 'asc' }
    case 'highest':
      return { total: 'desc' }
    case 'lowest':
      return { total: 'asc' }
    case 'newest':
    default:
      return { createdAt: 'desc' }
  }
}

export async function listOrders(filters: ListOrdersQuery, actingUser: ActingUser) {
  const where = buildWhere(filters, actingUser)
  const skip = (filters.page - 1) * filters.pageSize

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderListSelect,
      orderBy: resolveOrderBy(filters.sortBy),
      skip,
      take: filters.pageSize,
    }),
  ])

  return { orders, total, page: filters.page, pageSize: filters.pageSize }
}

// Backs the ADMIN "filter by cashier" dropdown. Lists every cashier
// account regardless of isActive, since a deactivated cashier's past
// orders must remain filterable.
export function listCashiers() {
  return prisma.user.findMany({
    where: { role: 'CASHIER' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

export async function getOrderById(orderId: string, actingUser: ActingUser) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude })
  if (!order) {
    throw AppError.notFound('Order not found')
  }
  if (actingUser.role === 'CASHIER' && order.cashierId !== actingUser.id) {
    throw AppError.forbidden('You do not have permission to view this order')
  }
  return order
}
