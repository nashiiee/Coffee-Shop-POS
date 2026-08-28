// One-off script: removes leftover inactive test/seed products and
// categories from the Neon production catalog (early dev-testing cruft
// that got carried along by copy-catalog-to-neon.mjs, since that script
// mirrors isActive state rather than filtering to only-active rows). Not
// part of the app — run directly with tsx.
//
// Usage: DATABASE_URL=... npx tsx scripts/clean-neon-catalog-cruft.mjs
import { PrismaClient } from '@prisma/client'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')

const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  const inactiveProducts = await prisma.product.findMany({ where: { isActive: false }, select: { id: true, name: true } })
  console.log(`Removing ${inactiveProducts.length} inactive products:`, inactiveProducts.map((p) => p.name))

  for (const { id } of inactiveProducts) {
    await prisma.productVariant.deleteMany({ where: { productId: id } })
    await prisma.productModifier.deleteMany({ where: { productId: id } })
    await prisma.inventoryTransaction.deleteMany({ where: { inventoryItem: { productId: id } } })
    await prisma.inventoryItem.deleteMany({ where: { productId: id } })
    await prisma.product.delete({ where: { id } })
  }

  // Children before parents, so a sub-category is never left pointing at an
  // already-deleted parent.
  const inactiveCategories = await prisma.category.findMany({
    where: { isActive: false },
    select: { id: true, name: true, parentId: true },
  })
  const children = inactiveCategories.filter((c) => c.parentId !== null)
  const topLevel = inactiveCategories.filter((c) => c.parentId === null)
  console.log(`Removing ${inactiveCategories.length} inactive categories:`, inactiveCategories.map((c) => c.name))

  for (const { id } of children) {
    await prisma.category.delete({ where: { id } })
  }
  for (const { id } of topLevel) {
    await prisma.category.delete({ where: { id } })
  }

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
