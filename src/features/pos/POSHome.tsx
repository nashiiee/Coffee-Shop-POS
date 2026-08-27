import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import * as catalogApi from '../catalog/api'
import type { Category, Product } from '../catalog/types'
import { CartProvider } from './cart/CartProvider'
import { CategoryRail } from './CategoryRail'
import { POSWorkspace } from './POSWorkspace'
import { MenuIcon } from './icons'

export function POSHome() {
  const { accessToken } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTopCategoryId, setSelectedTopCategoryId] = useState<string | null>(null)
  const [isNavExpanded, setIsNavExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([catalogApi.listProducts(accessToken), catalogApi.listCategories(accessToken, { activeOnly: true })])
      .then(([productsResult, categoriesResult]) => {
        if (cancelled) return
        setProducts(productsResult)
        setCategories(categoriesResult)
        // Default to the first top-level category (e.g. Coffee) rather than
        // leaving nothing selected — the rail no longer has an "All" option
        // of its own, so an unselected state would hide the sub-category row
        // and look like the whole nav vanished.
        const firstTopCategory = categoriesResult.find((category) => category.parentId === null)
        if (firstTopCategory) setSelectedTopCategoryId(firstTopCategory.id)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load the product catalog')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const topCategories = useMemo(() => categories.filter((category) => category.parentId === null), [categories])

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#1c140d]">
      <nav
        aria-label="Menu and departments"
        className={`flex shrink-0 flex-col overflow-hidden py-6 transition-[width] duration-200 ease-out ${
          isNavExpanded ? 'w-56' : 'w-20'
        }`}
      >
        <div className={`flex w-full ${isNavExpanded ? 'justify-start pl-5' : 'justify-center'}`}>
          <button
            type="button"
            aria-label={isNavExpanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-expanded={isNavExpanded}
            onClick={() => setIsNavExpanded((expanded) => !expanded)}
            className="text-white/60 hover:text-white"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex w-full flex-1 flex-col py-8">
          <CategoryRail
            categories={topCategories}
            selectedCategoryId={selectedTopCategoryId}
            onSelect={setSelectedTopCategoryId}
            isExpanded={isNavExpanded}
          />
        </div>
      </nav>

      <div className="flex min-h-0 flex-1">
        {error ? (
          <p role="alert" className="m-4 rounded-4xl bg-white p-6 text-rose-600">
            {error}
          </p>
        ) : isLoading ? (
          <p className="m-4 rounded-4xl bg-white p-6 text-stone-500">Loading products…</p>
        ) : (
          <CartProvider>
            <POSWorkspace products={products} categories={categories} selectedTopCategoryId={selectedTopCategoryId} />
          </CartProvider>
        )}
      </div>
    </div>
  )
}
