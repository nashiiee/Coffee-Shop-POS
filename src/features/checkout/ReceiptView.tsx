import { formatCents, formatOrderNumber } from '../../lib/money'
import type { OrderRecord } from './types'

const SHOP_NAME = 'Culture Cup'

interface ReceiptViewProps {
  order: OrderRecord
}

export function ReceiptView({ order }: ReceiptViewProps) {
  return (
    <div className="mx-auto max-w-sm rounded border bg-white p-6 font-mono text-sm print:border-0 print:shadow-none">
      <div className="mb-4 text-center">
        <p className="text-lg font-semibold">{SHOP_NAME}</p>
        <p>Order {formatOrderNumber(order.sequenceNumber)}</p>
        <p>{new Date(order.createdAt).toLocaleString()}</p>
        <p>Cashier: {order.cashier.name}</p>
      </div>

      <div className="mb-4 space-y-2 border-y py-3">
        {order.items.map((item) => (
          <div key={item.id}>
            <div className="flex justify-between">
              <span>
                {item.quantity}× {item.productNameSnapshot}
                {item.variantNameSnapshot ? ` (${item.variantNameSnapshot})` : ''}
              </span>
              <span>{formatCents(item.lineSubtotal)}</span>
            </div>
            {item.modifiers.map((modifier) => (
              <div key={modifier.id} className="flex justify-between pl-4 text-xs text-gray-600">
                <span>+ {modifier.modifierNameSnapshot}</span>
                <span>{formatCents(modifier.priceSnapshot)}</span>
              </div>
            ))}
            <div className="pl-4 text-xs text-gray-600">
              {formatCents(item.unitPriceSnapshot)} each
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCents(order.subtotal)}</span>
        </div>
        {order.discountAmount > 0 ? (
          <div className="flex justify-between">
            <span>Discount{order.discountNameSnapshot ? ` (${order.discountNameSnapshot})` : ''}</span>
            <span>−{formatCents(order.discountAmount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t pt-1 text-base font-semibold">
          <span>Total</span>
          <span>{formatCents(order.total)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Payment Method</span>
          <span>{order.payment.method}</span>
        </div>
        <div className="flex justify-between">
          <span>Amount Received</span>
          <span>{formatCents(order.payment.amountReceived)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Change</span>
          <span>{formatCents(order.payment.changeGiven)}</span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">Thank you!</p>
    </div>
  )
}
