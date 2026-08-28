// One-off script: copies the local dev shop's catalog (categories,
// products, variants, modifiers, product-modifier links, inventory items,
// discounts) into the Neon production shop. Not part of the app — run
// directly with tsx and two DATABASE_URL-shaped env vars.
//
// Usage:
//   LOCAL_DATABASE_URL=... NEON_DATABASE_URL=... NEON_SHOP_ID=... npx tsx scripts/copy-catalog-to-neon.mjs
import { PrismaClient } from '@prisma/client'

const localUrl = process.env.LOCAL_DATABASE_URL
const neonUrl = process.env.NEON_DATABASE_URL
const neonShopId = process.env.NEON_SHOP_ID

if (!localUrl || !neonUrl || !neonShopId) {
  throw new Error('LOCAL_DATABASE_URL, NEON_DATABASE_URL, and NEON_SHOP_ID are all required')
}

const local = new PrismaClient({ datasources: { db: { url: localUrl } } })
const neon = new PrismaClient({ datasources: { db: { url: neonUrl } } })

async function main() {
  const localShop = await local.shop.findFirst()
  if (!localShop) throw new Error('No shop found in the local database')

  const [categories, products, modifiers, discounts] = await Promise.all([
    local.category.findMany({ where: { shopId: localShop.id } }),
    local.product.findMany({ where: { shopId: localShop.id }, include: { variants: true, modifiers: true, inventory: true } }),
    local.modifier.findMany({ where: { shopId: localShop.id } }),
    local.discount.findMany({ where: { shopId: localShop.id } }),
  ])

  console.log(
    `Copying from local shop "${localShop.name}": ${categories.length} categories, ${products.length} products, ${modifiers.length} modifiers, ${discounts.length} discounts`,
  )

  // Two passes for categories: insert without parentId first (children may
  // be inserted before their parent otherwise), then wire up parentId in a
  // second pass once every row exists.
  await neon.category.createMany({
    data: categories.map((c) => ({
      id: c.id,
      shopId: neonShopId,
      name: c.name,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      parentId: null,
    })),
  })
  for (const c of categories) {
    if (c.parentId) {
      await neon.category.update({ where: { id: c.id }, data: { parentId: c.parentId } })
    }
  }

  await neon.product.createMany({
    data: products.map((p) => ({
      id: p.id,
      shopId: neonShopId,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description,
      basePrice: p.basePrice,
      isActive: p.isActive,
      // Admin-uploaded photos live only on the local machine's disk — never
      // copy the reference, so the frontend falls back to its bundled stock
      // photo/icon instead of a broken <img>.
      imageUrl: null,
    })),
  })

  const allVariants = products.flatMap((p) => p.variants)
  if (allVariants.length > 0) {
    await neon.productVariant.createMany({
      data: allVariants.map((v) => ({
        id: v.id,
        productId: v.productId,
        name: v.name,
        price: v.price,
        isActive: v.isActive,
      })),
    })
  }

  if (modifiers.length > 0) {
    await neon.modifier.createMany({
      data: modifiers.map((m) => ({ id: m.id, shopId: neonShopId, name: m.name, price: m.price, isActive: m.isActive })),
    })
  }

  const allProductModifiers = products.flatMap((p) => p.modifiers)
  if (allProductModifiers.length > 0) {
    await neon.productModifier.createMany({
      data: allProductModifiers.map((pm) => ({ productId: pm.productId, modifierId: pm.modifierId })),
    })
  }

  // Every product needs an InventoryItem or checkout's stock-deduction step
  // throws "Insufficient stock" (see inventory.service.ts) — copy the local
  // quantities so ordering works immediately, not a bare default.
  const inventoryItems = products.filter((p) => p.inventory).map((p) => p.inventory)
  if (inventoryItems.length > 0) {
    await neon.inventoryItem.createMany({
      data: inventoryItems.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantityOnHand: i.quantityOnHand,
        reorderLevel: i.reorderLevel,
      })),
    })
  }

  if (discounts.length > 0) {
    await neon.discount.createMany({
      data: discounts.map((d) => ({
        id: d.id,
        shopId: neonShopId,
        name: d.name,
        type: d.type,
        value: d.value,
        isActive: d.isActive,
        expiresAt: d.expiresAt,
      })),
    })
  }

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await local.$disconnect()
    await neon.$disconnect()
  })
