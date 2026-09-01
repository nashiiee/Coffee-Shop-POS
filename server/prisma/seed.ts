import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function parseCost(): number {
  const raw = process.env.BCRYPT_COST ?? '12'
  const cost = Number(raw)
  if (!Number.isInteger(cost) || cost < 10 || cost > 15) {
    throw new Error(`BCRYPT_COST must be an integer between 10 and 15, got "${raw}"`)
  }
  return cost
}

async function seedUser(
  email: string | undefined,
  password: string | undefined,
  role: 'ADMIN' | 'CASHIER',
  cost: number,
) {
  if (!email || !password) {
    throw new Error(`SEED_${role}_EMAIL and SEED_${role}_PASSWORD must be set to seed the initial ${role.toLowerCase()}`)
  }
  const passwordHash = await bcrypt.hash(password, cost)
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: role === 'ADMIN' ? 'Admin' : 'Cashier', email, passwordHash, role },
  })
  console.log(`Seeded ${role.toLowerCase()} user: ${user.email}`)
}

async function main() {
  const cost = parseCost()
  await seedUser(process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, 'ADMIN', cost)
  await seedUser(process.env.SEED_CASHIER_EMAIL, process.env.SEED_CASHIER_PASSWORD, 'CASHIER', cost)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
