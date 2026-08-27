import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { formatCents, formatOrderNumber } from '../../lib/money'
import { dateStampedFilename, exportCsv } from '../../lib/csv'
import * as ordersApi from './api'
import * as dashboardApi from '../dashboard/api'
import { StatTile } from '../admin/StatTile'
import {
  BagIcon,
  CalendarIcon,
  CoinIcon,
  DownloadIcon,
  EyeIcon,
  FilterIcon,
  PrinterIcon,
  ReceiptIcon,
  ScaleIcon,
  SearchIcon,
  TrendDownIcon,
  UserIcon,
} from '../admin/icons'
import type { CashierOption, ListOrdersResponse, OrderFilters, OrderListItem } from './types'
import type { DashboardData } from '../dashboard/types'

const STATUS_OPTIONS = ['COMPLETED', 'CANCELLED', 'REFUNDED']
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest total' },
  { value: 'lowest', label: 'Lowest total' },
]
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const emptyFilters: OrderFilters = { page: 1, pageSize: 10, sortBy: 'newest' }

const STATUS_PILL_CLASSES: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-amber-50 text-amber-700',
  REFUNDED: 'bg-rose-50 text-rose-600',
}

function statusPillClass(status: string): string {
  return STATUS_PILL_CLASSES[status] ?? 'bg-stone-100 text-stone-600'
}

const EXPORT_PAGE_SIZE = 100 // matches the server's max pageSize (see order.schema.ts)

// Exports every order matching the current filters, not just the page
// currently on screen — the server caps pageSize at 100, so this pages
// through as many requests as needed and concatenates the results.
async function fetchAllOrders(accessToken: string | null, filters: OrderFilters): Promise<OrderListItem[]> {
  const first = await ordersApi.listOrders(accessToken, { ...filters, page: 1, pageSize: EXPORT_PAGE_SIZE })
  const orders = [...first.orders]
  const totalPages = Math.ceil(first.total / EXPORT_PAGE_SIZE)
  for (let page = 2; page <= totalPages; page++) {
    const next = await ordersApi.listOrders(accessToken, { ...filters, page, pageSize: EXPORT_PAGE_SIZE })
    orders.push(...next.orders)
  }
  return orders
}

function downloadOrdersCsv(orders: OrderListItem[]) {
  const headers = ['Order #', 'Date', 'Cashier', 'Items', 'Payment', 'Total', 'Status']
  const rows = orders.map((o) => [
    formatOrderNumber(o.sequenceNumber),
    new Date(o.createdAt).toLocaleString(),
    o.cashier.name,
    o._count.items,
    o.payment?.method ?? '',
    formatCents(o.total),
    o.status,
  ])
  exportCsv(dateStampedFilename('orders'), headers, rows)
}

// Simple windowed page-number list: first, last, current +/-1, with "…" gaps.
function pageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1])
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const result: (number | 'ellipsis')[] = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push('ellipsis')
    result.push(page)
    previous = page
  }
  return result
}

interface OrdersPageProps {
  // Lets this same page be mounted at both the cashier-facing top-level
  // /orders route and, for admins, nested under /admin/orders (so the
  // AdminLayout header/nav/sign-out shell stays mounted) — the "View
  // receipt" link needs to point at whichever base it's currently under.
  basePath?: string
}

export function OrdersPage({ basePath = '/orders' }: OrdersPageProps) {
  const { user, accessToken } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [filters, setFilters] = useState<OrderFilters>(emptyFilters)
  const [pendingSearch, setPendingSearch] = useState('')
  const [result, setResult] = useState<ListOrdersResponse | null>(null)
  const [cashiers, setCashiers] = useState<CashierOption[]>([])
  const [stats, setStats] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ordersApi
      .listOrders(accessToken, filters)
      .then((res) => {
        if (!cancelled) setResult(res)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load orders')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, filters])

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    ordersApi
      .listCashiers(accessToken)
      .then((res) => {
        if (!cancelled) setCashiers(res)
      })
      .catch(() => undefined)
    // The same dashboard aggregate already computed for /admin — reused
    // here instead of adding order-page-specific stat endpoints, so this
    // stat row costs one extra request total, not four.
    dashboardApi
      .getDashboard(accessToken)
      .then((res) => {
        if (!cancelled) setStats(res)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [accessToken, isAdmin])

  function applyFilter(patch: Partial<OrderFilters>) {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }))
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    applyFilter({ search: pendingSearch || undefined })
  }

  function clearFilters() {
    setPendingSearch('')
    setFilters(emptyFilters)
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }))
  }

  async function handleExport() {
    setIsExporting(true)
    setExportError(null)
    try {
      const orders = await fetchAllOrders(accessToken, filters)
      downloadOrdersCsv(orders)
    } catch (err: unknown) {
      setExportError(err instanceof ApiError ? err.message : 'Failed to export orders')
    } finally {
      setIsExporting(false)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1
  const currentPage = filters.page ?? 1
  const rangeStart = result && result.total > 0 ? (currentPage - 1) * result.pageSize + 1 : 0
  const rangeEnd = result ? Math.min(currentPage * result.pageSize, result.total) : 0
  const hasActiveFilters = Boolean(filters.dateFrom || filters.dateTo || filters.cashierId || filters.paymentMethod || filters.status || filters.search)

  return (
    <section className="space-y-6">
      <div className="flex items-start gap-3">
        {isAdmin ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2b1b12] text-white">
            <ReceiptIcon />
          </span>
        ) : null}
        <div>
          <h2 className="text-2xl font-semibold text-stone-800">{isAdmin ? 'Orders' : 'Order History'}</h2>
          <p className="text-sm text-stone-500">
            {isAdmin ? 'View and manage all customer orders' : 'Your completed and cancelled orders'}
          </p>
        </div>
      </div>

      {isAdmin && stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total Orders"
            Icon={BagIcon}
            tone="primary"
            value={String(stats.todayOrders)}
            footnote={<p className="mb-1 text-xs text-stone-400">Today</p>}
            change={stats.ordersChangePercent}
          />
          <StatTile
            label="Total Sales"
            Icon={CoinIcon}
            tone="green"
            value={formatCents(stats.todaySales)}
            footnote={<p className="mb-1 text-xs text-stone-400">Today</p>}
            change={stats.salesChangePercent}
          />
          <StatTile
            label="Average Order Value"
            Icon={ScaleIcon}
            tone="info"
            value={formatCents(stats.averageOrderValue)}
            footnote={<p className="mb-1 text-xs text-stone-400">Today</p>}
            change={null}
          />
          <StatTile
            label="Cancelled Orders"
            Icon={TrendDownIcon}
            tone="violet"
            value={String(stats.cancelledOrdersToday)}
            footnote={<p className="mb-1 text-xs text-stone-400">Today</p>}
            change={stats.cancelledOrdersChangePercent}
          />
        </div>
      ) : null}

      {isAdmin ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-600">Search</span>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  value={pendingSearch}
                  onChange={(event) => setPendingSearch(event.target.value)}
                  placeholder="Search by order # or cashier..."
                  className="w-full rounded-lg border border-stone-200 py-2 pr-3 pl-9 text-sm"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1 lg:col-span-2">
              <span className="text-sm font-medium text-stone-600">Date Range</span>
              <div className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
                <span className="shrink-0 text-stone-400">
                  <CalendarIcon />
                </span>
                <input
                  type="date"
                  value={filters.dateFrom ?? ''}
                  onChange={(event) => applyFilter({ dateFrom: event.target.value || undefined })}
                  className="w-full min-w-0 text-sm outline-none"
                  aria-label="Date from"
                />
                <span className="shrink-0 text-stone-300">–</span>
                <input
                  type="date"
                  value={filters.dateTo ?? ''}
                  onChange={(event) => applyFilter({ dateTo: event.target.value || undefined })}
                  className="w-full min-w-0 text-sm outline-none"
                  aria-label="Date to"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-600">Cashier</span>
              <select
                value={filters.cashierId ?? ''}
                onChange={(event) => applyFilter({ cashierId: event.target.value || undefined })}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="">All cashiers</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-600">Payment Method</span>
              <select
                value={filters.paymentMethod ?? ''}
                onChange={(event) => applyFilter({ paymentMethod: event.target.value || undefined })}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="">All methods</option>
                <option value="CASH">Cash</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-stone-600">Status</span>
              <select
                value={filters.status ?? ''}
                onChange={(event) => applyFilter({ status: event.target.value || undefined })}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
            >
              <FilterIcon />
              More filters
            </button>
            <div className="flex items-center gap-4">
              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className="text-sm text-stone-500 underline">
                  Clear filters
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleExport}
                disabled={!result || result.total === 0 || isExporting}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40"
              >
                <DownloadIcon />
                {isExporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-600">Search (order #)</span>
            <input
              type="text"
              value={pendingSearch}
              onChange={(event) => setPendingSearch(event.target.value)}
              placeholder="e.g. 42"
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="rounded-lg border border-stone-200 px-4 py-2 text-sm hover:bg-stone-50">
            Search
          </button>
          {hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className="text-sm text-stone-500 underline">
              Clear filters
            </button>
          ) : null}
        </form>
      )}

      {error ? (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      ) : null}

      {exportError ? (
        <p role="alert" className="text-red-600">
          {exportError}
        </p>
      ) : null}

      <div className={isAdmin ? 'rounded-2xl border border-stone-200 bg-white p-5 shadow-sm' : ''}>
        {isAdmin ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-stone-800">Orders List</h3>
              {result ? (
                <p className="text-sm text-stone-400">
                  Showing {rangeStart} to {rangeEnd} of {result.total} orders
                </p>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              Sort by
              <select
                value={filters.sortBy ?? 'newest'}
                onChange={(event) => applyFilter({ sortBy: event.target.value })}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {isLoading ? (
          <p>Loading…</p>
        ) : !result || result.orders.length === 0 ? (
          <p className="text-sm text-stone-400">No orders found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs tracking-wide text-stone-400 uppercase">
                    <th className="px-3 py-2 font-medium">Order #</th>
                    <th className="px-3 py-2 font-medium">Date &amp; Time</th>
                    {isAdmin ? <th className="px-3 py-2 font-medium">Cashier</th> : null}
                    <th className="px-3 py-2 font-medium">Items</th>
                    <th className="px-3 py-2 font-medium">Payment Method</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.orders.map((order) => (
                    <tr key={order.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-3 font-semibold whitespace-nowrap text-stone-800">{formatOrderNumber(order.sequenceNumber)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-stone-500">{new Date(order.createdAt).toLocaleString()}</td>
                      {isAdmin ? (
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="flex items-center gap-2 text-stone-700">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                              <UserIcon className="h-3.5 w-3.5" />
                            </span>
                            {order.cashier.name}
                          </span>
                        </td>
                      ) : null}
                      <td className="px-3 py-3 whitespace-nowrap text-stone-600">
                        {order._count.items} item{order._count.items === 1 ? '' : 's'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-stone-600">
                        {order.payment ? (
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-50 text-emerald-600">
                              <CoinIcon className="h-3 w-3" />
                            </span>
                            {order.payment.method === 'CASH' ? 'Cash' : order.payment.method}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium whitespace-nowrap text-stone-800">{formatCents(order.total)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClass(order.status)}`}>
                          {order.status === 'COMPLETED' ? 'Completed' : order.status === 'CANCELLED' ? 'Cancelled' : 'Refunded'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-2 text-stone-400">
                          <Link to={`${basePath}/${order.id}`} aria-label={`View receipt for order ${formatOrderNumber(order.sequenceNumber)}`} className="hover:text-amber-700">
                            <EyeIcon />
                          </Link>
                          {order.status === 'COMPLETED' ? (
                            <Link
                              to={`${basePath}/${order.id}`}
                              aria-label={`Print receipt for order ${formatOrderNumber(order.sequenceNumber)}`}
                              className="hover:text-amber-700"
                            >
                              <PrinterIcon />
                            </Link>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-stone-500 disabled:opacity-40"
                >
                  ‹
                </button>
                {pageNumbers(currentPage, totalPages).map((p, i) =>
                  p === 'ellipsis' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-stone-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      aria-current={p === currentPage ? 'page' : undefined}
                      className={`rounded-lg px-3 py-1.5 ${
                        p === currentPage ? 'bg-amber-600 text-white' : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                  className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-stone-500 disabled:opacity-40"
                >
                  ›
                </button>
              </div>

              {isAdmin ? (
                <label className="flex items-center gap-2 text-stone-500">
                  Rows per page
                  <select
                    value={filters.pageSize ?? 10}
                    onChange={(event) => setFilters((prev) => ({ ...prev, pageSize: Number(event.target.value), page: 1 }))}
                    className="rounded-lg border border-stone-200 px-2 py-1.5"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
