import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { formatCents } from '../../lib/money'
import { resolveProductImage } from '../../lib/productImages'
import { CupIcon, PowerIcon, TrashIcon } from '../admin/icons'
import { ConfirmDialog } from '../pos/ConfirmDialog'
import * as catalogApi from './api'
import type { Product } from './types'

interface ProductCardProps {
  product: Product
  onToggleActive: (product: Product) => void
  onDelete: (product: Product) => void
  isBusy: boolean
}

function ProductCard({ product, onToggleActive, onDelete, isBusy }: ProductCardProps) {
  const imageSrc = resolveProductImage(product.name, product.imageUrl)

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/admin/products/${product.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-stone-100">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={product.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-amber-700">
              <CupIcon className="h-10 w-10" />
            </div>
          )}
          <span className="absolute top-2 left-2 rounded-full bg-amber-50/95 px-2 py-0.5 text-[11px] font-medium tracking-wide text-amber-800 uppercase backdrop-blur">
            {product.category.name}
          </span>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-stone-800">{product.name}</p>
            {product.isActive ? null : (
              <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                Inactive
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-base font-bold tabular-nums text-amber-700">{formatCents(product.basePrice)}</span>
            {product.variants.length > 0 ? (
              <span className="text-[11px] text-stone-400">
                {product.variants.length} size{product.variants.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title={product.isActive ? 'Deactivate' : 'Activate'}
          aria-label={`${product.isActive ? 'Deactivate' : 'Activate'} ${product.name}`}
          disabled={isBusy}
          onClick={() => onToggleActive(product)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-stone-600 shadow-sm backdrop-blur hover:text-amber-700 disabled:opacity-50"
        >
          <PowerIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Delete"
          aria-label={`Delete ${product.name}`}
          disabled={isBusy}
          onClick={() => onDelete(product)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-stone-600 shadow-sm backdrop-blur hover:text-rose-600 disabled:opacity-50"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ProductsPage() {
  const { accessToken } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)

  async function toggleActive(product: Product) {
    setError(null)
    setBusyId(product.id)
    try {
      const updated = await catalogApi.updateProduct(accessToken, product.id, { isActive: !product.isActive })
      setProducts((current) => current.map((p) => (p.id === updated.id ? { ...p, isActive: updated.isActive } : p)))
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to update product')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    const product = pendingDelete
    if (!product) return
    setPendingDelete(null)
    setError(null)
    setBusyId(product.id)
    try {
      await catalogApi.deleteProduct(accessToken, product.id)
      setProducts((current) => current.filter((p) => p.id !== product.id))
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete product')
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    catalogApi
      .listProducts(accessToken)
      .then((result) => {
        if (!cancelled) setProducts(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load products')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-800">Products</h2>
          <p className="text-sm text-stone-500">
            {products.length} product{products.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          to="/admin/products/new"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          New product
        </Link>
      </div>
      {error ? (
        <p role="alert" className="mb-3 text-red-600">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-stone-500">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-stone-400">No products yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onToggleActive={(p) => void toggleActive(p)}
              onDelete={setPendingDelete}
              isBusy={busyId === product.id}
            />
          ))}
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete product?"
          message={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </section>
  )
}
