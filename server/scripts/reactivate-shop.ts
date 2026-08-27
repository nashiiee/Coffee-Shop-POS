import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mirror image of suspend-shop.ts — restores access immediately, no fresh
// login required (the next requireActiveShop check simply passes).
//
// Usage:
//   npx tsx scripts/reactivate-shop.ts --shop-id <id>

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

async function main() {
  const shopId = parseArg('--shop-id')

  if (!shopId) {
    throw new Error('Usage: reactivate-shop.ts --shop-id <id>')
  }

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: { subscriptionStatus: 'ACTIVE', suspendedAt: null, suspendedReason: null },
  })

  console.log(`Reactivated shop "${shop.name}" (${shop.id})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
