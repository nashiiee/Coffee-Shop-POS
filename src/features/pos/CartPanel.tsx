import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useCart } from './cart/useCart'
import { cartSubtotal, lineTotal } from './cart/cartReducer'
import { formatCents } from '../../lib/money'
import { resolveProductImage } from '../../lib/productImages'
import { ConfirmDialog } from './ConfirmDialog'
import { CupIcon } from '../admin/icons'
import * as checkoutApi from '../checkout/api'
import { previewDiscountAmount, previewTotal } from '../checkout/previewCalculations'
import type { Discount } from '../checkout/types'

type PendingConfirm = 'clear' | 'new-order' | null

interface CartPanelProps {
  onCheckout: () => void
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const { accessToken } = useAuth()
  const { cart, dispatch } = useCart()
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const subtotal = cartSubtotal(cart)
  const selectedDiscount = discounts.find((d) => d.id === cart.discountId) ?? null
  const discountAmount = previewDiscountAmount(subtotal, selectedDiscount)
  const total = previewTotal(subtotal, discountAmount)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)
  // Mirrors POSHome's pickerTriggerRef pattern: save the element that opened
  // the dialog so keyboard focus returns to it on cancel/confirm, instead of
  // falling back to <body> and losing the cashier's place.
  const confirmTriggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    checkoutApi
      .listDiscounts(accessToken)
      .then((result) => {
        if (!cancelled) setDiscounts(result)
      })
      .catch(() => {
        // Discounts are optional — if they fail to load, checkout without
        // one still works. Not surfaced as a blocking error.
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  function requestClearCart() {
    if (cart.items.length === 0) return
    confirmTriggerRef.current = document.activeElement as HTMLElement | null
    setPendingConfirm('clear')
  }

  function requestNewOrder() {
    if (cart.items.length === 0) return
    confirmTriggerRef.current = document.activeElement as HTMLElement | null
    setPendingConfirm('new-order')
  }

  function closeConfirm() {
    setPendingConfirm(null)
    confirmTriggerRef.current?.focus()
  }

  function handleConfirm() {
    dispatch({ type: 'RESET' })
    closeConfirm()
  }

  return (
    <aside className="flex h-full flex-col bg-stone-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">Current Order</h2>
        <button
          type="button"
          onClick={requestClearCart}
          disabled={cart.items.length === 0}
          className="text-sm text-stone-400 hover:text-rose-600 disabled:opacity-40"
        >
          Clear All
        </button>
      </div>

      {cart.items.length === 0 ? (
        <p className="flex-1 text-sm text-stone-400">No items yet. Tap a product to add it.</p>
      ) : (
        <ul className="flex-1 space-y-3 overflow-y-auto">
          {cart.items.map((item) => {
            const imageSrc = resolveProductImage(item.productName, null)
            return (
              <li key={item.id} className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100">
                  {imageSrc ? (
                    <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <CupIcon className="h-5 w-5 text-stone-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">
                    {item.productName}
                    {item.variantName ? ` — ${item.variantName}` : ''}
                  </p>
                  {item.modifiers.length > 0 ? (
                    <p className="truncate text-xs text-stone-400">{item.modifiers.map((m) => m.name).join(', ')}</p>
                  ) : null}
                  <p className="text-sm text-stone-400">{formatCents(lineTotal(item))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'DECREMENT', lineId: item.id })}
                    aria-label={`Decrease quantity of ${item.productName}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8935A] text-[#E8935A] hover:bg-[#FBE8D3]"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm font-medium text-stone-700">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'INCREMENT', lineId: item.id })}
                    aria-label={`Increase quantity of ${item.productName}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8935A] text-[#E8935A] hover:bg-[#FBE8D3]"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'REMOVE_ITEM', lineId: item.id })}
                  aria-label={`Remove ${item.productName} from order`}
                  className="ml-1 shrink-0 text-stone-300 hover:text-rose-600"
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-xs font-medium text-stone-500">Discount</span>
        <select
          value={cart.discountId ?? ''}
          onChange={(event) => dispatch({ type: 'SET_DISCOUNT', discountId: event.target.value || null })}
          className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:border-[#E8935A] focus:ring-1 focus:ring-[#E8935A] focus:outline-none"
        >
          <option value="">No discount</option>
          {discounts.map((discount) => (
            <option key={discount.id} value={discount.id}>
              {discount.name} ({discount.type === 'PERCENTAGE' ? `${discount.value}%` : formatCents(discount.value)})
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 space-y-1.5 border-t border-dashed border-stone-200 pt-4 text-sm">
        <div className="flex justify-between text-stone-500">
          <span>Subtotal</span>
          <span className="text-stone-700">{formatCents(subtotal)}</span>
        </div>
        <div className="flex justify-between text-stone-500">
          <span>Discount</span>
          <span className="text-stone-700">−{formatCents(discountAmount)}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-3">
        <span className="text-base font-semibold text-stone-900">Total</span>
        <span className="text-xl font-bold text-stone-900">{formatCents(total)}</span>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={cart.items.length === 0}
        className="mt-4 rounded-xl bg-[#201810] py-4 text-base font-medium text-white hover:bg-[#2b2016] disabled:opacity-40"
      >
        Checkout
      </button>
      <button
        type="button"
        onClick={requestNewOrder}
        className="mt-2 rounded-xl border border-stone-200 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
      >
        Start new order
      </button>

      {pendingConfirm ? (
        <ConfirmDialog
          title={pendingConfirm === 'clear' ? 'Clear cart?' : 'Start a new order?'}
          message={
            pendingConfirm === 'clear'
              ? 'This removes every item from the current order.'
              : 'This clears the current order to start a fresh one.'
          }
          confirmLabel={pendingConfirm === 'clear' ? 'Clear cart' : 'Start new order'}
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
        />
      ) : null}
    </aside>
  )
}
