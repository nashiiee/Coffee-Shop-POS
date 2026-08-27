import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { formatCents, dollarsToCents } from '../../lib/money'
import { useCart } from '../pos/cart/useCart'
import { cartSubtotal, lineTotal } from '../pos/cart/cartReducer'
import * as checkoutApi from './api'
import { previewDiscountAmount, previewTotal } from './previewCalculations'
import type { CheckoutRequest, Discount, OrderRecord } from './types'

interface CheckoutScreenProps {
  onSuccess: (order: OrderRecord) => void
  onCancel: () => void
}

export function CheckoutScreen({ onSuccess, onCancel }: CheckoutScreenProps) {
  const { accessToken } = useAuth()
  const { cart } = useCart()
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [amountReceivedInput, setAmountReceivedInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Stable for the lifetime of this screen: if the checkout POST succeeds
  // but the response is lost (network blip) and the cashier retries with
  // the same cash amount, the backend treats it as the same order instead
  // of charging/deducting stock twice. A genuinely new attempt (cashier
  // navigates back to the cart and returns) remounts this screen and gets
  // a fresh key.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

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

  const subtotal = cartSubtotal(cart)
  // Discount is chosen back in the cart panel, not here — this screen only
  // displays what was already selected and resolves its name/type/value for
  // the preview math.
  const selectedDiscount = discounts.find((d) => d.id === cart.discountId) ?? null
  const discountAmount = previewDiscountAmount(subtotal, selectedDiscount)
  const total = previewTotal(subtotal, discountAmount)
  const amountReceived = amountReceivedInput.trim() === '' ? 0 : dollarsToCents(amountReceivedInput)
  const hasEnteredAmount = amountReceivedInput.trim() !== ''
  const isSufficient = hasEnteredAmount && amountReceived >= total
  const shortfall = total - amountReceived
  const changeGiven = isSufficient ? amountReceived - total : 0

  async function handleConfirm() {
    if (!isSufficient || isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    const payload: CheckoutRequest = {
      items: cart.items.map((item) => ({
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        modifierIds: item.modifiers.map((m) => m.modifierId),
        quantity: item.quantity,
      })),
      ...(cart.discountId ? { discountId: cart.discountId } : {}),
      amountReceived,
      idempotencyKey,
      ...(cart.notes ? { notes: cart.notes } : {}),
    }
    try {
      const order = await checkoutApi.checkout(accessToken, payload)
      onSuccess(order)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Checkout failed. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 p-6 sm:grid-cols-2 sm:gap-8 sm:p-8">
      <section>
        <h2 className="mb-4 text-xl font-semibold text-stone-900">Order summary</h2>
        <ul className="mb-4 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {cart.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between px-4 py-3">
              <div>
                <p className="font-medium text-stone-800">
                  {item.productName}
                  {item.variantName ? ` — ${item.variantName}` : ''} × {item.quantity}
                </p>
                {item.modifiers.length > 0 ? (
                  <p className="text-sm text-stone-500">{item.modifiers.map((m) => m.name).join(', ')}</p>
                ) : null}
              </div>
              <span className="font-medium text-stone-800">{formatCents(lineTotal(item))}</span>
            </li>
          ))}
        </ul>

        {selectedDiscount ? (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
            <span className="font-medium text-emerald-800">{selectedDiscount.name}</span>
            <span className="text-emerald-700">
              {selectedDiscount.type === 'PERCENTAGE' ? `${selectedDiscount.value}% off` : `${formatCents(selectedDiscount.value)} off`}
            </span>
          </div>
        ) : null}

        <div className="space-y-1.5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between text-sm text-stone-500">
            <span>Subtotal</span>
            <span className="text-stone-700">{formatCents(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-stone-500">
            <span>Discount</span>
            <span className="text-stone-700">−{formatCents(discountAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-stone-100 pt-2 text-lg font-semibold text-stone-900">
            <span>Total</span>
            <span>{formatCents(total)}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-stone-900">Payment</h2>
        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-stone-500">Payment Method</p>
          <p className="mb-3 font-medium text-stone-800">CASH</p>
          <p className="text-sm text-stone-500">Total Due</p>
          <p className="mb-3 text-2xl font-semibold text-stone-900">{formatCents(total)}</p>

          <label className="mb-3 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-stone-700">Cash Received</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountReceivedInput}
              onChange={(event) => setAmountReceivedInput(event.target.value)}
              autoFocus
              className="rounded-lg border border-stone-200 px-3 py-3 text-lg focus:border-[#E8935A] focus:ring-1 focus:ring-[#E8935A] focus:outline-none"
            />
          </label>

          {hasEnteredAmount && !isSufficient ? (
            <p role="alert" className="mb-3 text-rose-600">
              Insufficient payment
              <br />
              {formatCents(shortfall)} remaining
            </p>
          ) : null}

          {isSufficient ? (
            <div className="mb-3">
              <p className="text-sm text-stone-500">Change</p>
              <p className="text-2xl font-semibold text-amber-700">{formatCents(changeGiven)}</p>
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mb-3 text-rose-600">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-stone-200 px-5 py-3 text-base font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            Back to cart
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!isSufficient || isSubmitting}
            className="flex-1 rounded-xl bg-[#201810] px-5 py-3 text-lg font-medium text-white hover:bg-[#2b2016] disabled:opacity-40"
          >
            {isSubmitting ? 'Processing…' : 'Complete Payment'}
          </button>
        </div>
      </section>
    </div>
  )
}
