import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { ReceiptView } from '../checkout/ReceiptView'
import type { OrderRecord } from '../checkout/types'
import * as ordersApi from './api'
import { VoidOrderDialog } from './VoidOrderDialog'

interface OrderDetailPageProps {
  // Same reasoning as OrdersPage's basePath — this page is mounted at both
  // the cashier-facing /orders/:id route and, for admins, nested under
  // /admin/orders/:id so AdminLayout's shell stays mounted.
  backPath?: string
}

type PendingVoidAction = 'cancel' | 'refund' | null

export function OrderDetailPage({ backPath = '/orders' }: OrderDetailPageProps) {
  const { user, accessToken } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingVoidAction, setPendingVoidAction] = useState<PendingVoidAction>(null)
  const [voidError, setVoidError] = useState<string | null>(null)
  const [isVoiding, setIsVoiding] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ordersApi
      .getOrder(accessToken, id)
      .then((res) => {
        if (!cancelled) setOrder(res)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load the receipt')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, id])

  async function handleVoidConfirm(reason: string) {
    if (!id || !pendingVoidAction) return
    setVoidError(null)
    setIsVoiding(true)
    try {
      const updated =
        pendingVoidAction === 'cancel'
          ? await ordersApi.cancelOrder(accessToken, id, reason)
          : await ordersApi.refundOrder(accessToken, id, reason)
      setOrder(updated)
      setPendingVoidAction(null)
    } catch (err: unknown) {
      // Deliberately does NOT close the dialog here — the dialog's own
      // backdrop would hide a page-level error banner from view, and
      // closing would also discard the reason the admin already typed.
      setVoidError(err instanceof ApiError ? err.message : 'Failed to update the order')
    } finally {
      setIsVoiding(false)
    }
  }

  const canVoid = isAdmin && order?.status === 'COMPLETED'
  const isVoided = order && order.status !== 'COMPLETED'

  return (
    <section>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h2 className="text-xl font-semibold">Receipt</h2>
        <Link to={backPath} className="text-sm underline">
          Back to order history
        </Link>
      </div>

      {error ? (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      ) : isLoading ? (
        <p>Loading…</p>
      ) : order ? (
        <div className="flex flex-col items-center gap-4">
          {isVoided ? (
            <div role="status" className="w-full max-w-sm rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 print:hidden">
              <p className="font-medium">
                This order was {order.status === 'CANCELLED' ? 'cancelled' : 'refunded'}
                {order.voidedAt ? ` on ${new Date(order.voidedAt).toLocaleString()}` : ''}
                {order.voidedBy ? ` by ${order.voidedBy.name}` : ''}.
              </p>
              {order.voidReason ? <p className="mt-1">Reason: {order.voidReason}</p> : null}
            </div>
          ) : null}

          <ReceiptView order={order} />

          <div className="flex flex-wrap justify-center gap-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border px-4 py-3 text-base hover:bg-gray-50"
            >
              Reprint Receipt
            </button>
            {canVoid ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setVoidError(null)
                    setPendingVoidAction('cancel')
                  }}
                  className="rounded-lg border border-rose-300 px-4 py-3 text-base text-rose-700 hover:bg-rose-50"
                >
                  Cancel Order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoidError(null)
                    setPendingVoidAction('refund')
                  }}
                  className="rounded-lg border border-rose-300 px-4 py-3 text-base text-rose-700 hover:bg-rose-50"
                >
                  Refund Order
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingVoidAction ? (
        <VoidOrderDialog
          title={pendingVoidAction === 'cancel' ? 'Cancel this order?' : 'Refund this order?'}
          actionLabel={pendingVoidAction === 'cancel' ? 'Cancel Order' : 'Refund Order'}
          isSubmitting={isVoiding}
          error={voidError}
          onConfirm={(reason) => void handleVoidConfirm(reason)}
          onCancel={() => {
            setVoidError(null)
            setPendingVoidAction(null)
          }}
        />
      ) : null}
    </section>
  )
}
