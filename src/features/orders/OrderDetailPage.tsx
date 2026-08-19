import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { ReceiptView } from '../checkout/ReceiptView'
import type { OrderRecord } from '../checkout/types'
import * as ordersApi from './api'

interface OrderDetailPageProps {
  // Same reasoning as OrdersPage's basePath — this page is mounted at both
  // the cashier-facing /orders/:id route and, for admins, nested under
  // /admin/orders/:id so AdminLayout's shell stays mounted.
  backPath?: string
}

export function OrderDetailPage({ backPath = '/orders' }: OrderDetailPageProps) {
  const { accessToken } = useAuth()
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
          <ReceiptView order={order} />
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border px-4 py-3 text-base hover:bg-gray-50 print:hidden"
          >
            Reprint Receipt
          </button>
        </div>
      ) : null}
    </section>
  )
}
