import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { copyShopLogo } from '../src/services/shopLogo.service.js'

const prisma = new PrismaClient()

// Changes an existing shop's display name and/or logo (both shown in the
// admin UI and on printed receipts once the client logs in — see the
// per-shop branding plan). --name and --logo are both optional but at least
// one is required; only what's provided gets updated.
//
// Usage:
//   npx tsx scripts/update-shop-branding.ts --shop-id <id> --name "Culture Cup" --logo ./culture-cup-logo.png

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

async function main() {
  const shopId = parseArg('--shop-id')
  const name = parseArg('--name')
  const logoPath = parseArg('--logo')

  if (!shopId || (!name && !logoPath)) {
    throw new Error('Usage: update-shop-branding.ts --shop-id <id> [--name "<display name>"] [--logo <path-to-image-file>]')
  }

  const logoUrl = logoPath ? await copyShopLogo(shopId, logoPath) : undefined

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: { ...(name ? { name } : {}), ...(logoUrl ? { logoUrl } : {}) },
  })

  console.log(`Updated shop "${shop.name}" (${shop.id})`)
  if (logoUrl) console.log(`Logo set from ${logoPath}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
