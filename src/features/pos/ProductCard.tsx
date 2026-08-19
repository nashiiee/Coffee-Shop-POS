import type { Product } from '../catalog/types'
import { displayPrice } from './productHelpers'

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="flex min-h-24 flex-col items-start justify-between rounded-lg border-2 border-transparent bg-white p-4 text-left shadow-sm ring-1 ring-gray-200 hover:border-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"
    >
      <span className="text-lg font-medium">{product.name}</span>
      <span className="mt-2 text-base font-medium text-amber-800">{displayPrice(product)}</span>
    </button>
  )
}
