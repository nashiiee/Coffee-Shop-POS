import { useState } from 'react'
import { formatCents, formatOrderNumber } from '../../lib/money'
import { ReceiptView } from './ReceiptView'
import type { OrderRecord } from './types'

interface SuccessScreenProps {
  order: OrderRecord
  onNewOrder: () => void
}

export function SuccessScreen({ order, onNewOrder }: SuccessScreenProps) {
  const [showReceipt, setShowReceipt] = useState(false)

  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <div className="mb-6 rounded-full bg-green-100 p-4 text-4xl">✓</div>
      <h1 className="mb-2 text-2xl font-semibold">Payment Successful</h1>
      <p className="mb-6 text-gray-600">Order {formatOrderNumber(order.sequenceNumber)}</p>

      <div className="mb-6 space-y-2 rounded border p-4 text-left">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="font-medium">{formatCents(order.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cash Received</span>
          <span className="font-medium">{formatCents(order.payment.amountReceived)}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold text-amber-700">
          <span>Change</span>
          <span>{formatCents(order.payment.changeGiven)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowReceipt((prev) => !prev)}
          className="rounded-lg border px-4 py-3 text-base hover:bg-gray-50"
        >
          {showReceipt ? 'Hide Receipt' : 'View Receipt'}
        </button>
        {showReceipt ? (
          <>
            <ReceiptView order={order} />
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border px-4 py-3 text-base hover:bg-gray-50 print:hidden"
            >
              Print Receipt
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onNewOrder}
          className="rounded-lg bg-amber-700 py-3 text-lg font-medium text-white"
        >
          New Order
        </button>
      </div>
    </div>
  )
}
