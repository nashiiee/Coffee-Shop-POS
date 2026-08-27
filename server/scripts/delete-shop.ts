import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/scripts -> server/uploads/{products,shops}
const PRODUCT_UPLOADS_DIR = path.join(__dirname, '../uploads/products')
const SHOP_UPLOADS_DIR = path.join(__dirname, '../uploads/shops')

// Permanently and irreversibly deletes a shop and every row scoped to it:
// products (+ variants, modifiers-link, inventory), categories, modifiers,
// discounts, orders (+ items, payments, inventory movements), audit logs,
// and staff accounts — plus any uploaded logo/product image files on disk.
// Deletion order mirrors every onDelete: Restrict relation in
// schema.prisma's Shop model (see its own top comment) so this never trips
// a foreign-key error partway through.
//
// This is for wiping test/demo shops only. A real client's data should
// never be hard-deleted this way — suspend it instead (suspend-shop.ts).
// There is no undo.
//
// Usage:
//   npx tsx scripts/delete-shop.ts --shop-id <id>              (dry run — shows what would be deleted)
//   npx tsx scripts/delete-shop.ts --shop-id <id> --confirm    (actually deletes)

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

async function main() {
  const shopId = parseArg('--shop-id')
  const confirmed = process.argv.includes('--confirm')

  if (!shopId) {
    throw new Error('Usage: delete-shop.ts --shop-id <id> [--confirm]')
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId } })
  if (!shop) {
    throw new Error(`No shop found with id ${shopId}`)
  }

  const [userCount, categoryCount, productCount, orderCount] = await Promise.all([
    prisma.user.count({ where: { shopId } }),
    prisma.category.count({ where: { shopId } }),
    prisma.product.count({ where: { shopId } }),
    prisma.order.count({ where: { shopId } }),
  ])

  console.log(`Shop "${shop.name}" (${shop.id}):`)
  console.log(`  ${userCount} user(s), ${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'}, ${productCount} product(s), ${orderCount} order(s) — plus all their variants/payments/inventory movements/audit entries.`)

  if (!confirmed) {
    console.log('\nDry run only — nothing deleted. Re-run with --confirm to permanently delete all of this.')
    return
  }

  // Grab uploaded image paths before the rows referencing them are gone.
  const products = await prisma.product.findMany({ where: { shopId }, select: { imageUrl: true } })

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { shopId } }),
    prisma.inventoryTransaction.deleteMany({ where: { shopId } }),
    prisma.order.deleteMany({ where: { shopId } }), // cascades OrderItem + OrderItemModifier
    prisma.inventoryItem.deleteMany({ where: { product: { shopId } } }),
    prisma.productVariant.deleteMany({ where: { product: { shopId } } }),
    prisma.product.deleteMany({ where: { shopId } }), // cascades ProductModifier
    prisma.category.deleteMany({ where: { shopId, parentId: { not: null } } }), // children before parents
    prisma.category.deleteMany({ where: { shopId } }),
    prisma.modifier.deleteMany({ where: { shopId } }),
    prisma.discount.deleteMany({ where: { shopId } }),
    prisma.auditLog.deleteMany({ where: { shopId } }),
    prisma.user.deleteMany({ where: { shopId } }),
    prisma.shop.delete({ where: { id: shopId } }),
  ])

  console.log(`Deleted shop "${shop.name}" (${shop.id}).`)

  // Best-effort file cleanup — an orphaned upload file isn't a correctness
  // problem, so failures here are swallowed (mirrors setProductImage's
  // previous-file cleanup in productImage.service.ts).
  for (const product of products) {
    if (product.imageUrl?.startsWith('/uploads/products/')) {
      const filename = product.imageUrl.replace('/uploads/products/', '')
      await fs.unlink(path.join(PRODUCT_UPLOADS_DIR, filename)).catch(() => {})
    }
  }
  if (shop.logoUrl?.startsWith('/uploads/shops/')) {
    const filename = shop.logoUrl.replace('/uploads/shops/', '')
    await fs.unlink(path.join(SHOP_UPLOADS_DIR, filename)).catch(() => {})
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
