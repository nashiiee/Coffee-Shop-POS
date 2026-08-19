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
  const [selectedDiscountId, setSelectedDiscountId] = useState('')
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
  const selectedDiscount = discounts.find((d) => d.id === selectedDiscountId) ?? null
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
      ...(selectedDiscountId ? { discountId: selectedDiscountId } : {}),
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
    <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 p-6">
      <section>
        <h2 className="mb-4 text-xl font-semibold">Order summary</h2>
        <ul className="mb-4 divide-y rounded border">
          {cart.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between px-4 py-3">
              <div>
                <p className="font-medium">
                  {item.productName}
                  {item.variantName ? ` — ${item.variantName}` : ''} × {item.quantity}
                </p>
                {item.modifiers.length > 0 ? (
                  <p className="text-sm text-gray-600">{item.modifiers.map((m) => m.name).join(', ')}</p>
                ) : null}
              </div>
              <span className="font-medium">{formatCents(lineTotal(item))}</span>
            </li>
          ))}
        </ul>

        <label className="mb-4 flex flex-col gap-1">
          <span className="text-sm font-medium">Discount</span>
          <select
            value={selectedDiscountId}
            onChange={(event) => setSelectedDiscountId(event.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">No discount</option>
            {discounts.map((discount) => (
              <option key={discount.id} value={discount.id}>
                {discount.name} ({discount.type === 'PERCENTAGE' ? `${discount.value}%` : formatCents(discount.value)})
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1 rounded border p-4">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCents(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Discount</span>
            <span>−{formatCents(discountAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-lg font-semibold">
            <span>Total</span>
            <span>{formatCents(total)}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Payment</h2>
        <div className="mb-4 rounded border p-4">
          <p className="text-sm text-gray-600">Payment Method</p>
          <p className="mb-3 font-medium">CASH</p>
          <p className="text-sm text-gray-600">Total Due</p>
          <p className="mb-3 text-2xl font-semibold">{formatCents(total)}</p>

          <label className="mb-3 flex flex-col gap-1">
            <span className="text-sm font-medium">Cash Received</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountReceivedInput}
              onChange={(event) => setAmountReceivedInput(event.target.value)}
              autoFocus
              className="rounded border px-3 py-3 text-lg"
            />
          </label>

          {hasEnteredAmount && !isSufficient ? (
            <p role="alert" className="mb-3 text-red-600">
              Insufficient payment
              <br />
              {formatCents(shortfall)} remaining
            </p>
          ) : null}

          {isSufficient ? (
            <div className="mb-3">
              <p className="text-sm text-gray-600">Change</p>
              <p className="text-2xl font-semibold text-amber-700">{formatCents(changeGiven)}</p>
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mb-3 text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border px-4 py-3 text-base hover:bg-gray-50 disabled:opacity-40"
          >
            Back to cart
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!isSufficient || isSubmitting}
            className="flex-1 rounded-lg bg-amber-700 py-3 text-lg font-medium text-white disabled:opacity-40"
          >
            {isSubmitting ? 'Processing…' : 'Complete Payment'}
          </button>
        </div>
      </section>
    </div>
  )
}
