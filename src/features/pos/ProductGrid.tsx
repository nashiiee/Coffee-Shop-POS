import type { Product, ProductVariant } from '../catalog/types'
import { ProductCard } from './ProductCard'

interface ProductGridProps {
  products: Product[]
  searchQuery: string
  onSelect: (product: Product) => void
  onQuickAdd: (product: Product, variant: ProductVariant) => void
}

export function ProductGrid({ products, searchQuery, onSelect, onQuickAdd }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        {searchQuery.trim() ? `No products match "${searchQuery}".` : 'No products in this category.'}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onSelect={onSelect} onQuickAdd={onQuickAdd} />
      ))}
    </div>
  )
}
