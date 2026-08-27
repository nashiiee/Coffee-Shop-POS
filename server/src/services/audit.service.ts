import { Prisma, type AuditAction } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type { AuditLogQuery } from '../schemas/audit.schema.js'

type DbClient = Prisma.TransactionClient | typeof prisma

export interface RecordAuditInput {
  shopId: string
  actorId: string
  action: AuditAction
  resource: string
  resourceId: string
  previousState?: unknown
  newState?: unknown
}

// Accepts an optional transaction client so callers already inside a
// $transaction (e.g. adjustInventory) can write the audit row atomically
// with the change it describes, instead of it landing separately and
// possibly surviving a rollback the real change didn't. actorName is
// resolved here (not passed in) so every call site can't forget it and so
// it's always the current name at write time, snapshotted onto the row.
export async function recordAudit(input: RecordAuditInput, db: DbClient = prisma): Promise<void> {
  const actor = await db.user.findUnique({ where: { id: input.actorId }, select: { name: true } })
  await db.auditLog.create({
    data: {
      shopId: input.shopId,
      actorId: input.actorId,
      actorName: actor?.name ?? 'Unknown',
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      previousState: input.previousState === undefined ? Prisma.JsonNull : (input.previousState as Prisma.InputJsonValue),
      newState: input.newState === undefined ? Prisma.JsonNull : (input.newState as Prisma.InputJsonValue),
    },
  })
}

export async function listAuditLogs(query: AuditLogQuery, shopId: string) {
  const { action, resource, dateFrom, dateTo, page, pageSize } = query
  // dateTo is a date-only value (midnight) coerced from a "YYYY-MM-DD" query
  // param — an exclusive `lt: dateTo` would drop the entire selected end
  // day, not just events after it. Shifting to the start of the *next* day
  // makes the filter inclusive of the whole selected day.
  const dateToExclusive = dateTo ? new Date(dateTo.getTime() + 24 * 60 * 60 * 1000) : undefined
  const where: Prisma.AuditLogWhereInput = {
    shopId,
    ...(action ? { action } : {}),
    ...(resource ? { resource } : {}),
    ...(dateFrom || dateToExclusive
      ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateToExclusive ? { lt: dateToExclusive } : {}) } }
      : {}),
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return { logs, total, page, pageSize }
}
