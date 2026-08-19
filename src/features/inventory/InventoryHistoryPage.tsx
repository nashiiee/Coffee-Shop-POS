import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import * as inventoryApi from './api'
import type { InventoryTransaction } from './types'

export function InventoryHistoryPage() {
  const { accessToken } = useAuth()
  const { productId } = useParams<{ productId: string }>()
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    inventoryApi
      .getInventoryHistory(accessToken, productId)
      .then((result) => {
        if (!cancelled) setTransactions(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load inventory history')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, productId])

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Inventory history</h2>
        <Link to="/admin/inventory" className="text-sm underline">
          Back to inventory
        </Link>
      </div>
      {error ? <p role="alert" className="mb-3 text-red-600">{error}</p> : null}

      {isLoading ? (
        <p>Loading…</p>
      ) : transactions.length === 0 ? (
        <p>No inventory changes recorded yet.</p>
      ) : (
        <table className="w-full rounded border text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Change</th>
              <th className="px-3 py-2">Balance after</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => (
              <tr key={txn.id} className="border-b">
                <td className="px-3 py-2">{new Date(txn.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{txn.type}</td>
                <td className="px-3 py-2">{txn.quantityChange > 0 ? `+${txn.quantityChange}` : txn.quantityChange}</td>
                <td className="px-3 py-2">{txn.quantityAfter}</td>
                <td className="px-3 py-2">{txn.reason ?? '—'}</td>
                <td className="px-3 py-2">{txn.createdBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
