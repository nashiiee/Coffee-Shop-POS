import { useMemo, useState } from 'react'
import type { Product } from '../catalog/types'
import { ProductCard } from './ProductCard'

interface ProductGridProps {
  products: Product[]
  onSelect: (product: Product) => void
}

export function ProductGrid({ products, onSelect }: ProductGridProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return products
    return products.filter((product) => product.name.toLowerCase().includes(normalized))
  }, [products, query])

  return (
    <div className="flex h-full flex-col">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className="mb-4 rounded-lg border px-4 py-3 text-base"
      />
      {filtered.length === 0 ? (
        <p className="text-gray-500">No products match "{query}".</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}
