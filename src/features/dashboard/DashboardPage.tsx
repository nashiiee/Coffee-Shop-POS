import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { formatCents, formatOrderNumber } from '../../lib/money'
import * as dashboardApi from './api'
import { HourlySalesChart } from './HourlySalesChart'
import { PaymentMethodDonut } from './PaymentMethodDonut'
import { ProductThumbnail } from './ProductThumbnail'
import { AlertIcon, CoinIcon, ReceiptIcon, ScaleIcon } from '../admin/icons'
import { StatTile } from '../admin/StatTile'
import type { DashboardData } from './types'

// UI-only addition per design reference — the backend PaymentMethod enum only
// supports CASH today, so GCash always renders as a zero-amount legend entry
// (no functionality implied) until the backend actually supports it.
const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH: '#92400e',
  GCASH: '#0284c7',
}
const FALLBACK_PAYMENT_COLOR = '#78716c'

function PeriodBadge() {
  return <span className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-500">Today ▾</span>
}

function formatOrderDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ViewAllLink({ to }: { to: string }) {
  return (
    <Link to={to} className="text-sm font-medium text-amber-700 hover:text-amber-800">
      View all
    </Link>
  )
}

export function DashboardPage() {
  const { accessToken } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    dashboardApi
      .getDashboard(accessToken)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load the dashboard')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    )
  }

  if (isLoading || !data) {
    return <p>Loading dashboard…</p>
  }

  const totalTransactions = data.paymentMethodBreakdown.reduce((sum, m) => sum + m.count, 0)
  const totalPaymentAmount = data.paymentMethodBreakdown.reduce((sum, m) => sum + m.total, 0)
  const donutSegments = [
    ...data.paymentMethodBreakdown.map((m) => ({
      label: m.method,
      amount: m.total,
      color: PAYMENT_METHOD_COLORS[m.method] ?? FALLBACK_PAYMENT_COLOR,
    })),
    ...(data.paymentMethodBreakdown.some((m) => m.method === 'GCASH')
      ? []
      : [{ label: 'GCASH', amount: 0, color: PAYMENT_METHOD_COLORS.GCASH! }]),
  ]
  const lowStockCount = data.lowStockProducts.length
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const salesSparkline = data.salesTrend.map((p) => p.totalSales)
  const ordersSparkline = data.salesTrend.map((p) => p.orderCount)
  const avgOrderSparkline = data.salesTrend.map((p) => (p.orderCount > 0 ? p.totalSales / p.orderCount : 0))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-800">Dashboard</h2>
          <p className="text-sm text-stone-500">{today}</p>
        </div>
        <PeriodBadge />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today's Sales"
          Icon={CoinIcon}
          tone="primary"
          value={formatCents(data.todaySales)}
          change={data.salesChangePercent}
          sparkline={salesSparkline}
        />
        <StatTile
          label="Today's Orders"
          Icon={ReceiptIcon}
          tone="secondary"
          value={String(data.todayOrders)}
          change={data.ordersChangePercent}
          sparkline={ordersSparkline}
        />
        <StatTile
          label="Average Order Value"
          Icon={ScaleIcon}
          tone="tertiary"
          value={formatCents(data.averageOrderValue)}
          change={data.averageOrderValueChangePercent}
          sparkline={avgOrderSparkline}
        />
        <StatTile
          label="Low Stock"
          Icon={AlertIcon}
          tone="alert"
          value={`${lowStockCount} item${lowStockCount === 1 ? '' : 's'}`}
          status={
            lowStockCount > 0 ? (
              <span className="text-xs font-semibold text-rose-600">⚠ Warning</span>
            ) : (
              <span className="text-xs font-semibold text-teal-700">All stocked</span>
            )
          }
        />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-800">Sales Overview</h3>
          <PeriodBadge />
        </div>
        <HourlySalesChart points={data.hourlySales} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-stone-800">Top Selling Products</h3>
            <ViewAllLink to="/admin/reports" />
          </div>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-stone-400">No sales in the last 30 days.</p>
          ) : (
            <ul className="space-y-4">
              {data.topProducts.map((product, i) => (
                <li key={product.productId} className="flex items-center gap-3">
                  <span className="w-4 text-sm font-medium text-stone-400">{i + 1}</span>
                  <ProductThumbnail name={product.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800">{product.name}</p>
                    <p className="text-xs text-stone-400">{product.quantitySold} sold</p>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-stone-800">{formatCents(product.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-stone-800">Payment Methods</h3>
          {totalPaymentAmount === 0 ? (
            <p className="text-sm text-stone-400">No payments recorded today.</p>
          ) : (
            <>
              <PaymentMethodDonut segments={donutSegments} />
              <ul className="mt-4 space-y-2">
                {donutSegments.map((segment) => (
                  <li key={segment.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-stone-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                      {segment.label === 'GCASH' ? 'GCash' : segment.label.charAt(0) + segment.label.slice(1).toLowerCase()}
                    </span>
                    <span className="font-medium text-stone-800">
                      {totalPaymentAmount === 0 ? '0%' : `${Math.round((segment.amount / totalPaymentAmount) * 100)}%`}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3">
                <div>
                  <p className="text-xs text-stone-400">Total Transactions</p>
                  <p className="text-base font-semibold text-stone-800">{totalTransactions}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">Total Amount</p>
                  <p className="text-base font-semibold text-stone-800">{formatCents(totalPaymentAmount)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-stone-800">Recent Orders</h3>
            <ViewAllLink to="/admin/orders" />
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-stone-400">No completed orders yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between text-sm">
                  <span>
                    <p className="font-medium text-stone-800">{formatOrderNumber(order.sequenceNumber)}</p>
                    <p className="text-xs text-stone-400">{formatOrderDateTime(order.createdAt)}</p>
                  </span>
                  <span className="font-medium text-emerald-600">Completed</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-stone-800">Low Stock Items</h3>
          <ViewAllLink to="/admin/inventory" />
        </div>
        {data.lowStockProducts.length === 0 ? (
          <p className="text-sm text-stone-400">All products are sufficiently stocked.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.lowStockProducts.map((p) => (
              <li key={p.productId} className="flex items-center gap-3">
                <ProductThumbnail name={p.name} size={48} />
                <span className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">{p.name}</p>
                  <span className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    {p.quantityOnHand} units remaining
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
