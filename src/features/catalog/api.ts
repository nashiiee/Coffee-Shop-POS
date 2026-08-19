import { apiRequest } from '../../lib/apiClient'
import type { Category, Modifier, Product, ProductVariant } from './types'

type Token = string | null

export function listCategories(accessToken: Token) {
  return apiRequest<Category[]>('/api/categories', { accessToken })
}

export function createCategory(accessToken: Token, data: { name: string }) {
  return apiRequest<Category>('/api/categories', { method: 'POST', body: data, accessToken })
}

export function updateCategory(accessToken: Token, id: string, data: Partial<Pick<Category, 'name' | 'sortOrder' | 'isActive'>>) {
  return apiRequest<Category>(`/api/categories/${id}`, { method: 'PATCH', body: data, accessToken })
}

export function listModifiers(accessToken: Token) {
  return apiRequest<Modifier[]>('/api/modifiers', { accessToken })
}

export function createModifier(accessToken: Token, data: { name: string; price: number }) {
  return apiRequest<Modifier>('/api/modifiers', { method: 'POST', body: data, accessToken })
}

export function updateModifier(accessToken: Token, id: string, data: Partial<Pick<Modifier, 'name' | 'price' | 'isActive'>>) {
  return apiRequest<Modifier>(`/api/modifiers/${id}`, { method: 'PATCH', body: data, accessToken })
}

export function listProducts(accessToken: Token) {
  return apiRequest<Product[]>('/api/products', { accessToken })
}

export function getProduct(accessToken: Token, id: string) {
  return apiRequest<Product>(`/api/products/${id}`, { accessToken })
}

export function createProduct(
  accessToken: Token,
  data: { categoryId: string; name: string; description?: string; basePrice: number },
) {
  return apiRequest<Product>('/api/products', { method: 'POST', body: data, accessToken })
}

export function updateProduct(
  accessToken: Token,
  id: string,
  data: Partial<{ categoryId: string; name: string; description: string; basePrice: number; isActive: boolean }>,
) {
  return apiRequest<Product>(`/api/products/${id}`, { method: 'PATCH', body: data, accessToken })
}

export function deleteProduct(accessToken: Token, id: string) {
  return apiRequest<void>(`/api/products/${id}`, { method: 'DELETE', accessToken })
}

export function uploadProductImage(accessToken: Token, id: string, file: File) {
  const body = new FormData()
  body.append('image', file)
  return apiRequest<{ imageUrl: string }>(`/api/products/${id}/image`, { method: 'POST', body, accessToken })
}

export function createVariant(accessToken: Token, productId: string, data: { name: string; price: number }) {
  return apiRequest<ProductVariant>(`/api/products/${productId}/variants`, { method: 'POST', body: data, accessToken })
}

export function updateVariant(
  accessToken: Token,
  productId: string,
  variantId: string,
  data: Partial<Pick<ProductVariant, 'name' | 'price' | 'isActive'>>,
) {
  return apiRequest<ProductVariant>(`/api/products/${productId}/variants/${variantId}`, {
    method: 'PATCH',
    body: data,
    accessToken,
  })
}

export function setProductModifiers(accessToken: Token, productId: string, modifierIds: string[]) {
  return apiRequest<Product>(`/api/products/${productId}/modifiers`, {
    method: 'PUT',
    body: { modifierIds },
    accessToken,
  })
}
