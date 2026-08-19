import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/AppError.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// server/src/services -> server/uploads/products
export const PRODUCT_UPLOADS_DIR = path.join(__dirname, '../../uploads/products')

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

export function isAllowedProductImageMimeType(mimetype: string): boolean {
  return mimetype in ALLOWED_MIME_TO_EXT
}

interface UploadedImageFile {
  buffer: Buffer
  mimetype: string
}

export async function setProductImage(productId: string, file: UploadedImageFile): Promise<{ imageUrl: string }> {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) {
    throw AppError.notFound('Product not found')
  }
  if (!isAllowedProductImageMimeType(file.mimetype)) {
    throw AppError.badRequest('Image must be JPEG, PNG, or WebP')
  }

  const ext = ALLOWED_MIME_TO_EXT[file.mimetype]
  const filename = `${productId}-${Date.now()}.${ext}`
  await fs.mkdir(PRODUCT_UPLOADS_DIR, { recursive: true })
  await fs.writeFile(path.join(PRODUCT_UPLOADS_DIR, filename), file.buffer)

  // Best-effort cleanup of the previous uploaded file — an orphaned file on
  // disk isn't a correctness problem the way a broken imageUrl would be, so
  // a failed unlink (already gone, permissions) is not worth failing the
  // request over.
  if (product.imageUrl?.startsWith('/uploads/products/')) {
    const previousFilename = product.imageUrl.replace('/uploads/products/', '')
    await fs.unlink(path.join(PRODUCT_UPLOADS_DIR, previousFilename)).catch(() => {})
  }

  const imageUrl = `/uploads/products/${filename}`
  await prisma.product.update({ where: { id: productId }, data: { imageUrl } })
  return { imageUrl }
}
