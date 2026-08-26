import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useCart } from './cart/useCart'
import type { AddItemPayload } from './cart/types'
import type { Category, Product, ProductVariant } from '../catalog/types'
import { ProductGrid } from './ProductGrid'
import { ProductPicker } from './ProductPicker'
import { CartPanel } from './CartPanel'
import { ConfirmDialog } from './ConfirmDialog'
import { needsPicker } from './utils/productHelpers'
import { CheckoutScreen } from '../checkout/CheckoutScreen'
import { SuccessScreen } from '../checkout/SuccessScreen'
import type { OrderRecord } from '../checkout/types'
import { ChevronDownIcon, SettingsIcon } from './icons'
import { ChartIcon, ReceiptIcon, SearchIcon, UserIcon } from '../admin/icons'

type View = 'shopping' | 'checkout' | 'success'

interface POSWorkspaceProps {
  products: Product[]
  categories: Category[]
  selectedTopCategoryId: string | null
}

export function POSWorkspace({ products, categories, selectedTopCategoryId }: POSWorkspaceProps) {
  const { dispatch } = useCart()
  const { user, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null)
  const [view, setView] = useState<View>('shopping')
  const [completedOrder, setCompletedOrder] = useState<OrderRecord | null>(null)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  // The element that opened the picker, so focus returns to it on close —
  // otherwise a keyboard user closing the dialog loses their place on the page.
  const pickerTriggerRef = useRef<HTMLElement | null>(null)

  // Sub-categories of the selected top-level category (e.g. Espresso,
  // Cappuccino... under Coffee). Empty when the top category has none, or
  // when nothing top-level is selected — the horizontal row hides itself.
  const subCategories = useMemo(
    () => (selectedTopCategoryId ? categories.filter((category) => category.parentId === selectedTopCategoryId) : []),
    [categories, selectedTopCategoryId],
  )

  // A product can be tagged directly to the top-level category (e.g.
  // "Coffee") or to one of its sub-categories (e.g. "Espresso"). Selecting
  // the top level must show both.
  const categoryFilterIds = useMemo(() => {
    if (selectedTopCategoryId) return [selectedTopCategoryId, ...subCategories.map((category) => category.id)]
    return null
  }, [selectedTopCategoryId, subCategories])

  const visibleProducts = useMemo(() => {
    const active = products.filter((product) => product.isActive)
    const inCategory = categoryFilterIds ? active.filter((product) => categoryFilterIds.includes(product.categoryId)) : active
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return inCategory
    return inCategory.filter((product) => product.name.toLowerCase().includes(normalizedQuery))
  }, [products, categoryFilterIds, searchQuery])

  const headingCategory = categories.find((category) => category.id === selectedTopCategoryId)
  const headingText = headingCategory?.name ?? 'All Items'

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

  function handleQuickAdd(product: Product, variant: ProductVariant) {
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        variantName: variant.name,
        unitPrice: variant.price,
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
    return (
      <section aria-label="Checkout" className="flex min-h-0 flex-1 overflow-y-auto rounded-4xl bg-white">
        <CheckoutScreen onSuccess={handleCheckoutSuccess} onCancel={() => setView('shopping')} />
      </section>
    )
  }

  if (view === 'success' && completedOrder) {
    return (
      <section aria-label="Order complete" className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-4xl bg-white">
        <SuccessScreen order={completedOrder} onNewOrder={handleNewOrder} />
      </section>
    )
  }

  const isAdmin = user?.role === 'ADMIN'

  return (
    <section aria-label="Point of sale" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-4xl bg-white">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-stone-100 px-4 py-4 sm:px-6">
        <h1 className="shrink-0 text-2xl font-bold text-stone-900">{headingText}</h1>

        <div className="order-3 relative w-full flex-1 sm:order-0 sm:w-auto">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search for coffee, food etc"
            aria-label="Search products"
            className="w-full rounded-full bg-stone-100 py-2.5 pr-4 pl-10 text-sm text-stone-700 placeholder:text-stone-400 focus:ring-2 focus:ring-[#E8935A] focus:outline-none"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            to="/orders"
            aria-label="Order History"
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <ReceiptIcon className="h-4 w-4" />
          </Link>
          {isAdmin ? (
            <Link
              to="/admin/reports"
              aria-label="Reports"
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <ChartIcon className="h-4 w-4" />
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              to="/admin"
              aria-label="Admin settings"
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
          ) : null}
          <div className="ml-1 flex items-center gap-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FBE8D3] text-[#8a4a1c]">
              <UserIcon className="h-4 w-4" />
            </span>
            <span className="hidden text-sm font-medium text-stone-700 sm:inline">{user?.name}</span>
            <ChevronDownIcon className="hidden h-3.5 w-3.5 text-stone-400 sm:inline" />
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              className="ml-1 text-xs text-stone-400 hover:text-rose-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50 p-4 sm:p-6">
          <ProductGrid
            products={visibleProducts}
            searchQuery={searchQuery}
            onSelect={handleSelectProduct}
            onQuickAdd={handleQuickAdd}
          />
        </main>

        <div className="flex h-[46vh] w-full shrink-0 flex-col p-3 lg:h-auto lg:w-85">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-white shadow-sm">
            <CartPanel onCheckout={() => setView('checkout')} />
          </div>
        </div>
      </div>

      {pickerProduct ? (
        <ProductPicker product={pickerProduct} onAdd={handleAddFromPicker} onClose={closePicker} />
      ) : null}

      {showSignOutConfirm ? (
        <ConfirmDialog
          title="Sign out?"
          message="Are you sure you want to sign out?"
          confirmLabel="Sign out"
          onConfirm={() => void logout()}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      ) : null}
    </section>
  )
}
