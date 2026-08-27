import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// One-off migration script: creates a single Shop row representing this
// install's existing (pre-multi-tenant) data, and backfills shopId onto
// every row that doesn't have one yet. Safe to re-run — if nothing has a
// null shopId anymore, it's a no-op.
//
// nextOrderSequence is seeded to MAX(sequenceNumber) + 1, not 1 — this
// install already has historical orders using the old global Postgres
// SERIAL, and seeding to 1 would collide with an existing order number on
// the very first post-migration checkout.

function parseShopName(): string {
  const flagIndex = process.argv.indexOf('--name')
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1]!
  }
  return 'Coffee Shop'
}

async function main() {
  const usersWithoutShop = await prisma.user.count({ where: { shopId: null } })
  if (usersWithoutShop === 0) {
    console.log('No rows with a null shopId found — nothing to backfill.')
    return
  }

  const shopName = parseShopName()

  await prisma.$transaction(async (tx) => {
    const maxSequence = await tx.order.aggregate({ _max: { sequenceNumber: true } })
    const nextOrderSequence = (maxSequence._max.sequenceNumber ?? 0) + 1

    const shop = await tx.shop.create({
      data: { name: shopName, nextOrderSequence },
    })
    console.log(`Created shop "${shop.name}" (${shop.id}), nextOrderSequence=${nextOrderSequence}`)

    const results = await Promise.all([
      tx.user.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.category.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.product.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.modifier.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.discount.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.order.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.auditLog.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.orderItem.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.payment.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
      tx.inventoryTransaction.updateMany({ where: { shopId: null }, data: { shopId: shop.id } }),
    ])

    const labels = [
      'User',
      'Category',
      'Product',
      'Modifier',
      'Discount',
      'Order',
      'AuditLog',
      'OrderItem',
      'Payment',
      'InventoryTransaction',
    ]
    results.forEach((result, index) => {
      console.log(`Backfilled ${result.count} ${labels[index]} row(s)`)
    })
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
