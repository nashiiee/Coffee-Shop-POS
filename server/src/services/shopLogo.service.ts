import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/src/services -> server/uploads/shops
export const SHOP_UPLOADS_DIR = path.join(__dirname, '../../uploads/shops')

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp'])

// Used by the onboarding CLI scripts (create-shop.ts, update-shop-branding.ts)
// to copy a logo file from local disk into the served uploads directory —
// there's no HTTP upload route for shop logos, branding is set by whoever
// runs the script, not through the app itself.
export async function copyShopLogo(shopId: string, sourcePath: string): Promise<string> {
  const ext = path.extname(sourcePath).slice(1).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Logo must be a .jpg, .jpeg, .png, or .webp file, got "${sourcePath}"`)
  }

  const filename = `${shopId}.${ext}`
  await fs.mkdir(SHOP_UPLOADS_DIR, { recursive: true })
  await fs.copyFile(sourcePath, path.join(SHOP_UPLOADS_DIR, filename))

  return `/uploads/shops/${filename}`
}
