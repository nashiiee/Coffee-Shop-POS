import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { copyShopLogo } from '../src/services/shopLogo.service.js'

const prisma = new PrismaClient()

// Onboards a new client business: one Shop row + its first ADMIN user, in
// one transaction — a shop with zero admins can never bootstrap itself
// (mirrors disableUser's "can't disable the only active admin" invariant).
// --logo is optional and copies a local image file in as the shop's branding
// (see update-shop-branding.ts to set/change it after the shop already exists).
//
// Usage:
//   npx tsx scripts/create-shop.ts --name "Bean There Coffee" --admin-email admin@beanthere.test --admin-password "some-strong-password" [--logo ./logo.png]

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

function parseCost(): number {
  const raw = process.env.BCRYPT_COST ?? '12'
  const cost = Number(raw)
  if (!Number.isInteger(cost) || cost < 10 || cost > 15) {
    throw new Error(`BCRYPT_COST must be an integer between 10 and 15, got "${raw}"`)
  }
  return cost
}

async function main() {
  const name = parseArg('--name')
  const adminEmail = parseArg('--admin-email')
  const adminPassword = parseArg('--admin-password')
  const logoPath = parseArg('--logo')

  if (!name || !adminEmail || !adminPassword) {
    throw new Error('Usage: create-shop.ts --name "<shop name>" --admin-email <email> --admin-password <password>')
  }

  const passwordHash = await bcrypt.hash(adminPassword, parseCost())

  const result = await prisma.$transaction(async (tx) => {
    const shop = await tx.shop.create({ data: { name, nextOrderSequence: 1 } })
    const admin = await tx.user.create({
      data: { shopId: shop.id, name: 'Admin', email: adminEmail, passwordHash, role: 'ADMIN' },
    })
    return { shop, admin }
  })

  console.log(`Created shop "${result.shop.name}" (${result.shop.id})`)
  console.log(`Created admin ${result.admin.email} for this shop`)

  if (logoPath) {
    const logoUrl = await copyShopLogo(result.shop.id, logoPath)
    await prisma.shop.update({ where: { id: result.shop.id }, data: { logoUrl } })
    console.log(`Set shop logo from ${logoPath}`)
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
