import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import * as inventoryApi from './api'
import type { InventoryItem, InventoryTransactionType, StockStatus } from './types'

const STATUS_LABEL: Record<StockStatus, string> = {
  OUT_OF_STOCK: 'Out of stock',
  LOW_STOCK: 'Low stock',
  IN_STOCK: 'In stock',
}

const STATUS_CLASS: Record<StockStatus, string> = {
  OUT_OF_STOCK: 'bg-red-100 text-red-800',
  LOW_STOCK: 'bg-yellow-100 text-yellow-800',
  IN_STOCK: 'bg-green-100 text-green-800',
}

const REQUIRES_REASON: InventoryTransactionType[] = ['ADJUSTMENT', 'WASTE']
const ALWAYS_DECREASES: InventoryTransactionType[] = ['STOCK_OUT', 'WASTE']

type AdjustDirection = 'increase' | 'decrease'

function computeQuantityChange(type: InventoryTransactionType, magnitude: number, direction: AdjustDirection): number {
  if (ALWAYS_DECREASES.includes(type)) return -magnitude
  if (type === 'STOCK_IN') return magnitude
  // ADJUSTMENT is the only type that can go either way — a physical
  // recount might find more OR fewer units than currently on record.
  return direction === 'decrease' ? -magnitude : magnitude
}

export function InventoryPage() {
  const { accessToken } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false)

  const [adjustType, setAdjustType] = useState<InventoryTransactionType>('STOCK_IN')
  const [adjustDirection, setAdjustDirection] = useState<AdjustDirection>('increase')
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustKey, setAdjustKey] = useState('')
  const [reorderDrafts, setReorderDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    inventoryApi
      .listInventory(accessToken)
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load inventory')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  async function refresh() {
    const result = await inventoryApi.listInventory(accessToken)
    setItems(result)
  }

  function openAdjustForm(productId: string) {
    setOpenRowId(productId)
    setAdjustType('STOCK_IN')
    setAdjustDirection('increase')
    setAdjustQuantity('')
    setAdjustReason('')
    // Stable for the lifetime of this form: if the POST succeeds but the
    // browser never sees the response (dropped connection, etc.) and the
    // admin retries the identical form, the backend treats it as the same
    // operation instead of applying the stock change twice.
    setAdjustKey(crypto.randomUUID())
    setError(null)
  }

  async function handleAdjust(event: FormEvent<HTMLFormElement>, productId: string) {
    event.preventDefault()
    setError(null)
    setIsSubmittingAdjustment(true)
    const magnitude = Math.abs(Number(adjustQuantity))
    const quantityChange = computeQuantityChange(adjustType, magnitude, adjustDirection)

    try {
      await inventoryApi.adjustInventory(accessToken, productId, {
        type: adjustType,
        quantityChange,
        reason: adjustReason || undefined,
        idempotencyKey: adjustKey,
      })
      setOpenRowId(null)
    } catch (err) {
      setIsSubmittingAdjustment(false)
      setError(err instanceof ApiError ? err.message : 'Failed to record inventory change')
      return
    }

    // The change was recorded — a failure here only means the on-screen
    // list is stale, not that the adjustment itself failed. Don't report it
    // as an error; a manual reload always shows the true server state.
    try {
      await refresh()
    } catch {
      setError('Change recorded, but the list could not be refreshed — reload the page to see the latest counts.')
    } finally {
      setIsSubmittingAdjustment(false)
    }
  }

  async function handleSaveReorderLevel(productId: string) {
    const draft = reorderDrafts[productId]
    if (draft === undefined) return
    setError(null)
    try {
      await inventoryApi.updateReorderLevel(accessToken, productId, Number(draft))
      setReorderDrafts((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update reorder level')
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Inventory</h2>
      {error ? <p role="alert" className="mb-3 text-red-600">{error}</p> : null}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <ul className="divide-y rounded border">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{item.product.name}</span>{' '}
                  <span className={`ml-2 rounded px-2 py-0.5 text-xs ${STATUS_CLASS[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>Qty: {item.quantityOnHand}</span>
                  <label className="flex items-center gap-1">
                    Reorder at
                    <input
                      type="number"
                      min="0"
                      value={reorderDrafts[item.productId] ?? item.reorderLevel}
                      onChange={(event) =>
                        setReorderDrafts((prev) => ({ ...prev, [item.productId]: event.target.value }))
                      }
                      className="w-16 rounded border px-2 py-1"
                    />
                  </label>
                  <button type="button" onClick={() => void handleSaveReorderLevel(item.productId)} className="underline">
                    Save
                  </button>
                  <Link to={`/admin/inventory/${item.productId}/history`} className="underline">
                    History
                  </Link>
                  <button type="button" onClick={() => openAdjustForm(item.productId)} className="underline">
                    Adjust stock
                  </button>
                </div>
              </div>

              {openRowId === item.productId ? (
                <form
                  onSubmit={(event) => void handleAdjust(event, item.productId)}
                  className="mt-3 flex flex-wrap items-end gap-2 rounded border bg-gray-50 p-3"
                >
                  <label className="flex flex-col gap-1 text-sm">
                    Type
                    <select
                      value={adjustType}
                      onChange={(event) => setAdjustType(event.target.value as InventoryTransactionType)}
                      className="rounded border px-2 py-1"
                    >
                      <option value="STOCK_IN">Stock in</option>
                      <option value="STOCK_OUT">Stock out</option>
                      <option value="ADJUSTMENT">Adjustment</option>
                      <option value="WASTE">Waste</option>
                    </select>
                  </label>
                  {adjustType === 'ADJUSTMENT' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      Direction
                      <select
                        value={adjustDirection}
                        onChange={(event) => setAdjustDirection(event.target.value as AdjustDirection)}
                        className="rounded border px-2 py-1"
                      >
                        <option value="increase">Increase</option>
                        <option value="decrease">Decrease</option>
                      </select>
                    </label>
                  ) : null}
                  <label className="flex flex-col gap-1 text-sm">
                    Quantity {ALWAYS_DECREASES.includes(adjustType) ? '(amount removed)' : ''}
                    <input
                      type="number"
                      min="1"
                      required
                      value={adjustQuantity}
                      onChange={(event) => setAdjustQuantity(event.target.value)}
                      className="w-24 rounded border px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Reason {REQUIRES_REASON.includes(adjustType) ? '(required)' : '(optional)'}
                    <input
                      type="text"
                      required={REQUIRES_REASON.includes(adjustType)}
                      value={adjustReason}
                      onChange={(event) => setAdjustReason(event.target.value)}
                      className="rounded border px-2 py-1"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSubmittingAdjustment}
                    className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    {isSubmittingAdjustment ? 'Recording…' : 'Record'}
                  </button>
                  <button type="button" onClick={() => setOpenRowId(null)} className="text-sm underline">
                    Cancel
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
