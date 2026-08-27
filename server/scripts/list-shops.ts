import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Prints every shop's id (needed by suspend-shop.ts/reactivate-shop.ts),
// status, and first admin's email, so there's no need to query the
// database directly just to look up a shop id.
//
// Usage:
//   npx tsx scripts/list-shops.ts

async function main() {
  const shops = await prisma.shop.findMany({
    orderBy: { name: 'asc' },
    include: {
      users: { where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' }, take: 1, select: { email: true } },
    },
  })

  if (shops.length === 0) {
    console.log('No shops yet — run create-shop.ts to add one.')
    return
  }

  for (const shop of shops) {
    const adminEmail = shop.users[0]?.email ?? '(no admin found)'
    const status =
      shop.subscriptionStatus === 'ACTIVE'
        ? 'ACTIVE'
        : `SUSPENDED${shop.suspendedReason ? ` — ${shop.suspendedReason}` : ''}`
    console.log(`${shop.name}\n  id:     ${shop.id}\n  status: ${status}\n  admin:  ${adminEmail}\n`)
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
