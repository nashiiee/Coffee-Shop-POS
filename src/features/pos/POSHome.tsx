import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import * as catalogApi from '../catalog/api'
import type { Category, Product } from '../catalog/types'
import { CartProvider } from './cart/CartProvider'
import { useCart } from './cart/useCart'
import { CategoryNav } from './CategoryNav'
import { ProductGrid } from './ProductGrid'
import { ProductPicker } from './ProductPicker'
import { CartPanel } from './CartPanel'
import { needsPicker } from './productHelpers'
import type { AddItemPayload } from './cart/types'
import { CheckoutScreen } from '../checkout/CheckoutScreen'
import { SuccessScreen } from '../checkout/SuccessScreen'
import type { OrderRecord } from '../checkout/types'

type View = 'shopping' | 'checkout' | 'success'

function POSWorkspace({ products, categories }: { products: Product[]; categories: Category[] }) {
  const { dispatch } = useCart()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null)
  const [view, setView] = useState<View>('shopping')
  const [completedOrder, setCompletedOrder] = useState<OrderRecord | null>(null)
  // The element that opened the picker, so focus returns to it on close —
  // otherwise a keyboard user closing the dialog loses their place on the page.
  const pickerTriggerRef = useRef<HTMLElement | null>(null)

  const visibleProducts = useMemo(() => {
    const active = products.filter((product) => product.isActive)
    if (!selectedCategoryId) return active
    return active.filter((product) => product.categoryId === selectedCategoryId)
  }, [products, selectedCategoryId])

  function handleSelectProduct(product: Product) {
    if (needsPicker(product)) {
      pickerTriggerRef.current = document.activeElement as HTMLElement | null
      setPickerProduct(product)
      return
    }
    // No size/add-ons to choose — one tap adds it directly.
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        productId: product.id,
        productName: product.name,
        variantId: null,
        variantName: null,
        unitPrice: product.basePrice,
        modifiers: [],
        quantity: 1,
      },
    })
  }

  function closePicker() {
    setPickerProduct(null)
    pickerTriggerRef.current?.focus()
  }

  function handleAddFromPicker(payload: AddItemPayload) {
    dispatch({ type: 'ADD_ITEM', payload })
    closePicker()
  }

  function handleCheckoutSuccess(order: OrderRecord) {
    // The order and its payment are already durably recorded server-side —
    // safe to clear the working cart now that there's nothing left to lose.
    dispatch({ type: 'RESET' })
    setCompletedOrder(order)
    setView('success')
  }

  function handleNewOrder() {
    setCompletedOrder(null)
    setView('shopping')
  }

  if (view === 'checkout') {
    return <CheckoutScreen onSuccess={handleCheckoutSuccess} onCancel={() => setView('shopping')} />
  }

  if (view === 'success' && completedOrder) {
    return <SuccessScreen order={completedOrder} onNewOrder={handleNewOrder} />
  }

  return (
    <div className="grid h-[calc(100vh-64px)] grid-cols-[200px_1fr_320px]">
      <div className="overflow-y-auto border-r bg-gray-50 p-4">
        <CategoryNav categories={categories} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />
      </div>
      <div className="overflow-y-auto p-4">
        <ProductGrid products={visibleProducts} onSelect={handleSelectProduct} />
      </div>
      <CartPanel onCheckout={() => setView('checkout')} />

      {pickerProduct ? (
        <ProductPicker product={pickerProduct} onAdd={handleAddFromPicker} onClose={closePicker} />
      ) : null}
    </div>
  )
}

export function POSHome() {
  const { user, accessToken, logout } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([catalogApi.listProducts(accessToken), catalogApi.listCategories(accessToken)])
      .then(([productsResult, categoriesResult]) => {
        if (cancelled) return
        setProducts(productsResult)
        setCategories(categoriesResult)
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

  return (
    <div>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <h1 className="text-xl font-semibold">Point of Sale</h1>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {user?.name} ({user?.role})
          </span>
          <Link to="/orders" className="underline">
            Order History
          </Link>
          <button type="button" onClick={() => void logout()} className="underline">
            Sign out
          </button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="p-4 text-red-600">
          {error}
        </p>
      ) : isLoading ? (
        <p className="p-4">Loading products…</p>
      ) : (
        <CartProvider>
          <POSWorkspace products={products} categories={categories} />
        </CartProvider>
      )}
    </div>
  )
}
