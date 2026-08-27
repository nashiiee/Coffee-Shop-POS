import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// The kill switch. Suspending a shop takes effect on that shop's very next
// API request — requireActiveShop (server/src/middleware/requireActiveShop.ts)
// does a real DB read on every authenticated request, and login()/refresh()
// in auth.service.ts check subscriptionStatus directly too, so a suspended
// shop's staff can't even sign back in. No token blacklist or session store
// needed for this to take effect immediately.
//
// Usage:
//   npx tsx scripts/suspend-shop.ts --shop-id <id> --reason "Payment overdue"

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

async function main() {
  const shopId = parseArg('--shop-id')
  const reason = parseArg('--reason')

  if (!shopId || !reason) {
    throw new Error('Usage: suspend-shop.ts --shop-id <id> --reason "<reason>"')
  }

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: { subscriptionStatus: 'SUSPENDED', suspendedAt: new Date(), suspendedReason: reason },
  })

  console.log(`Suspended shop "${shop.name}" (${shop.id}) — reason: ${reason}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
