import { useState } from 'react'
import { useCart } from './cart/useCart'
import { cartSubtotal, lineTotal } from './cart/cartReducer'
import { formatCents } from '../../lib/money'
import { ConfirmDialog } from './ConfirmDialog'

type PendingConfirm = 'clear' | 'new-order' | null

interface CartPanelProps {
  onCheckout: () => void
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const { cart, dispatch } = useCart()
  const subtotal = cartSubtotal(cart)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)

  function requestClearCart() {
    if (cart.items.length === 0) return
    setPendingConfirm('clear')
  }

  function requestNewOrder() {
    if (cart.items.length === 0 && !cart.notes) return
    setPendingConfirm('new-order')
  }

  function handleConfirm() {
    dispatch({ type: 'RESET' })
    setPendingConfirm(null)
  }

  return (
    <aside className="flex h-full flex-col border-l bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Current order</h2>
        <button
          type="button"
          onClick={requestClearCart}
          disabled={cart.items.length === 0}
          className="text-sm text-red-600 underline disabled:opacity-40"
        >
          Clear cart
        </button>
      </div>

      {cart.items.length === 0 ? (
        <p className="flex-1 text-gray-500">No items yet. Tap a product to add it.</p>
      ) : (
        <ul className="flex-1 divide-y overflow-y-auto">
          {cart.items.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {item.productName}
                    {item.variantName ? ` — ${item.variantName}` : ''}
                  </p>
                  {item.modifiers.length > 0 ? (
                    <p className="text-sm text-gray-600">{item.modifiers.map((m) => m.name).join(', ')}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'REMOVE_ITEM', lineId: item.id })}
                  aria-label={`Remove ${item.productName} from order`}
                  className="text-gray-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'DECREMENT', lineId: item.id })}
                    aria-label={`Decrease quantity of ${item.productName}`}
                    className="h-9 w-9 rounded-lg border text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'INCREMENT', lineId: item.id })}
                    aria-label={`Increase quantity of ${item.productName}`}
                    className="h-9 w-9 rounded-lg border text-lg"
                  >
                    +
                  </button>
                </div>
                <span className="font-medium">{formatCents(lineTotal(item))}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-sm font-medium">Order notes</span>
        <textarea
          value={cart.notes}
          onChange={(event) => dispatch({ type: 'SET_NOTES', notes: event.target.value })}
          placeholder="e.g. for here, extra napkins"
          rows={2}
          className="rounded-lg border px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-lg font-semibold">
        <span>Subtotal</span>
        <span className="text-amber-700">{formatCents(subtotal)}</span>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={cart.items.length === 0}
        className="mt-3 rounded-lg bg-amber-700 py-4 text-lg font-medium text-white disabled:opacity-40"
      >
        Checkout
      </button>
      <button
        type="button"
        onClick={requestNewOrder}
        className="mt-2 rounded-lg border border-black py-3 text-base font-medium hover:bg-gray-50"
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
          onCancel={() => setPendingConfirm(null)}
        />
      ) : null}
    </aside>
  )
}
