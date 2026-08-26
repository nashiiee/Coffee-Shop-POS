import type { Product, ProductVariant } from '../catalog/types'
import { activeModifiers, activeVariants, displayPrice, isQuickAddEligible } from './utils/productHelpers'
import { resolveProductImage } from '../../lib/productImages'
import { formatCents } from '../../lib/money'
import { CartPlusIcon } from './icons'
import { CupIcon, ModifierIcon } from '../admin/icons'

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
  onQuickAdd: (product: Product, variant: ProductVariant) => void
}

export function ProductCard({ product, onSelect, onQuickAdd }: ProductCardProps) {
  const imageSrc = resolveProductImage(product.name, product.imageUrl)
  const variants = activeVariants(product)
  const modifiers = activeModifiers(product)
  const quickAdd = isQuickAddEligible(product)

  const image = (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-stone-100 shadow-[0_4px_14px_rgba(28,20,13,0.18)]">
      {imageSrc ? (
        <img src={imageSrc} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-stone-300">
          <CupIcon className="h-10 w-10" />
        </div>
      )}
      <span aria-hidden="true" className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#E8935A] text-white shadow-sm">
        <CartPlusIcon className="h-4 w-4" />
      </span>
    </div>
  )

  // Size-only products (no modifiers): each size is its own tappable control
  // that adds straight to the cart — no dialog, no second screen. The card
  // itself is just a container, not a button, since there's no single
  // "select this product" action anymore — the size chips are the action.
  if (quickAdd) {
    return (
      <div className="group flex flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-md ring-1 ring-stone-100 transition hover:shadow-lg">
        {image}
        <div className="flex flex-1 flex-col gap-2 pt-3">
          <span className="truncate text-sm font-semibold text-stone-800">{product.name}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => onQuickAdd(product, variant)}
                aria-label={`Add ${product.name} ${variant.name}, ${formatCents(variant.price)}`}
                className="flex-1 rounded-lg border border-stone-200 px-2 py-2 text-center text-xs font-medium text-stone-600 transition hover:border-[#E8935A] hover:bg-[#FBE8D3] hover:text-[#8a4a1c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8935A]"
              >
                <span className="block truncate">{variant.name}</span>
                <span className="block text-stone-400">{formatCents(variant.price)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      aria-label={product.name}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white p-5 text-left shadow-md ring-1 ring-stone-100 transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8935A]"
    >
      {image}

      <div className="flex flex-1 flex-col gap-2 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-stone-800">{product.name}</span>
          <span className="shrink-0 text-sm font-semibold text-stone-800">{displayPrice(product)}</span>
        </div>

        {modifiers.length > 0 ? (
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span className="truncate">Add {modifiers[0]!.modifier.name}</span>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-400">
              <ModifierIcon className="h-3 w-3" />
            </span>
          </div>
        ) : null}

        {variants.length > 0 ? <span className="text-xs text-stone-400">Choose a size</span> : null}
      </div>
    </button>
  )
}
