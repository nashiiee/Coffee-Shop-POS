import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { formatCents, formatOrderNumber } from '../../lib/money'
import { dateStampedFilename, exportCsv, type CsvRow } from '../../lib/csv'
import { ChartIcon, DownloadIcon } from '../admin/icons'
import * as reportsApi from './api'
import type {
  CancelledOrdersReport,
  CashierSalesReport,
  CategorySalesReport,
  DiscountsReport,
  InventoryMovementReport,
  PaymentMethodReport,
  ProductSalesReport,
  SalesReport,
} from './types'

const inputClasses = 'rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none'

type ReportTab = 'sales' | 'products' | 'categories' | 'cashiers' | 'payment-methods' | 'discounts' | 'cancelled-orders' | 'inventory-movement'

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'cashiers', label: 'Cashiers' },
  { id: 'payment-methods', label: 'Payment Methods' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'cancelled-orders', label: 'Cancelled Orders' },
  { id: 'inventory-movement', label: 'Inventory Movement' },
]

type ReportData =
  | { tab: 'sales'; data: SalesReport }
  | { tab: 'products'; data: ProductSalesReport }
  | { tab: 'categories'; data: CategorySalesReport }
  | { tab: 'cashiers'; data: CashierSalesReport }
  | { tab: 'payment-methods'; data: PaymentMethodReport }
  | { tab: 'discounts'; data: DiscountsReport }
  | { tab: 'cancelled-orders'; data: CancelledOrdersReport }
  | { tab: 'inventory-movement'; data: InventoryMovementReport }

const REPORT_EXPORT_PAGE_SIZE = 100 // matches the server's max pageSize (see reports.schema.ts)

// The paginated tabs only hold one page of rows in `result` — exporting
// needs every row matching the date range, so this pages through as many
// requests as it takes and concatenates them.
async function fetchAllCancelledOrders(
  accessToken: string | null,
  range: reportsApi.DateRangeParams,
): Promise<CancelledOrdersReport['orders']> {
  const first = await reportsApi.getCancelledOrdersReport(accessToken, { ...range, page: 1, pageSize: REPORT_EXPORT_PAGE_SIZE })
  const orders = [...first.orders]
  const totalPages = Math.ceil(first.total / REPORT_EXPORT_PAGE_SIZE)
  for (let page = 2; page <= totalPages; page++) {
    const next = await reportsApi.getCancelledOrdersReport(accessToken, { ...range, page, pageSize: REPORT_EXPORT_PAGE_SIZE })
    orders.push(...next.orders)
  }
  return orders
}

async function fetchAllInventoryMovements(
  accessToken: string | null,
  range: reportsApi.DateRangeParams,
): Promise<InventoryMovementReport['transactions']> {
  const first = await reportsApi.getInventoryMovementReport(accessToken, { ...range, page: 1, pageSize: REPORT_EXPORT_PAGE_SIZE })
  const transactions = [...first.transactions]
  const totalPages = Math.ceil(first.total / REPORT_EXPORT_PAGE_SIZE)
  for (let page = 2; page <= totalPages; page++) {
    const next = await reportsApi.getInventoryMovementReport(accessToken, { ...range, page, pageSize: REPORT_EXPORT_PAGE_SIZE })
    transactions.push(...next.transactions)
  }
  return transactions
}

// Mirrors ReportTable's per-tab column choices below, as plain rows instead
// of JSX — kept next to ReportTable so the two stay in sync by inspection.
function buildReportCsvRows(result: ReportData): { headers: string[]; rows: CsvRow[] } {
  if (result.tab === 'sales') {
    return {
      headers: ['Date', 'Orders', 'Sales', 'Discounts'],
      rows: result.data.buckets.map((b) => [b.date, b.orderCount, formatCents(b.totalSales), formatCents(b.totalDiscounts)]),
    }
  }
  if (result.tab === 'products') {
    return {
      headers: ['Product', 'Quantity Sold', 'Revenue'],
      rows: result.data.products.map((p) => [p.name, p.quantitySold, formatCents(p.revenue)]),
    }
  }
  if (result.tab === 'categories') {
    return {
      headers: ['Category', 'Quantity Sold', 'Revenue'],
      rows: result.data.categories.map((c) => [c.name, c.quantitySold, formatCents(c.revenue)]),
    }
  }
  if (result.tab === 'cashiers') {
    return {
      headers: ['Cashier', 'Orders', 'Revenue'],
      rows: result.data.cashiers.map((c) => [c.name, c.orderCount, formatCents(c.revenue)]),
    }
  }
  if (result.tab === 'payment-methods') {
    return {
      headers: ['Method', 'Orders', 'Revenue'],
      rows: result.data.methods.map((m) => [m.method, m.orderCount, formatCents(m.revenue)]),
    }
  }
  if (result.tab === 'discounts') {
    return {
      headers: ['Discount', 'Times Used', 'Total Discounted'],
      rows: result.data.discounts.map((d) => [d.name, d.timesUsed, formatCents(d.totalDiscounted)]),
    }
  }
  if (result.tab === 'cancelled-orders') {
    return {
      headers: ['Order', 'Status', 'Cashier', 'Total', 'Date'],
      rows: result.data.orders.map((o) => [
        formatOrderNumber(o.sequenceNumber),
        o.status,
        o.cashier.name,
        formatCents(o.total),
        new Date(o.createdAt).toLocaleString(),
      ]),
    }
  }
  // inventory-movement
  return {
    headers: ['Product', 'Type', 'Change', 'Balance After', 'Reason', 'By'],
    rows: result.data.transactions.map((t) => [t.productName, t.type, t.quantityChange, t.quantityAfter, t.reason ?? '', t.createdByName]),
  }
}

export function ReportsPage() {
  const { accessToken } = useAuth()
  const [activeTab, setActiveTab] = useState<ReportTab>('sales')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  function handleTabChange(tab: ReportTab) {
    setActiveTab(tab)
    setPage(1)
  }

  async function handleExport() {
    if (!result) return
    setIsExporting(true)
    setExportError(null)
    try {
      const range = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
      let exportData = result
      if (result.tab === 'cancelled-orders') {
        const orders = await fetchAllCancelledOrders(accessToken, range)
        exportData = { tab: 'cancelled-orders', data: { ...result.data, orders } }
      } else if (result.tab === 'inventory-movement') {
        const transactions = await fetchAllInventoryMovements(accessToken, range)
        exportData = { tab: 'inventory-movement', data: { ...result.data, transactions } }
      }
      const { headers, rows } = buildReportCsvRows(exportData)
      exportCsv(dateStampedFilename(`report-${activeTab}`), headers, rows)
    } catch (err: unknown) {
      setExportError(err instanceof ApiError ? err.message : 'Failed to export report')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const range = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }

    const fetchers: Record<ReportTab, () => Promise<ReportData>> = {
      sales: () => reportsApi.getSalesReport(accessToken, { ...range, period }).then((data) => ({ tab: 'sales', data })),
      products: () => reportsApi.getProductSalesReport(accessToken, range).then((data) => ({ tab: 'products', data })),
      categories: () => reportsApi.getCategorySalesReport(accessToken, range).then((data) => ({ tab: 'categories', data })),
      cashiers: () => reportsApi.getCashierSalesReport(accessToken, range).then((data) => ({ tab: 'cashiers', data })),
      'payment-methods': () => reportsApi.getPaymentMethodReport(accessToken, range).then((data) => ({ tab: 'payment-methods', data })),
      discounts: () => reportsApi.getDiscountsReport(accessToken, range).then((data) => ({ tab: 'discounts', data })),
      'cancelled-orders': () =>
        reportsApi.getCancelledOrdersReport(accessToken, { ...range, page, pageSize: 20 }).then((data) => ({ tab: 'cancelled-orders', data })),
      'inventory-movement': () =>
        reportsApi
          .getInventoryMovementReport(accessToken, { ...range, page, pageSize: 20 })
          .then((data) => ({ tab: 'inventory-movement', data })),
    }

    // Resets loading state for every dependency change (tab/filter/page),
    // not just the first mount — without this, switching tabs would leave
    // the PREVIOUS tab's table on screen (wrong columns) with no loading
    // indicator until the new request resolves. This is the pattern
    // React's own docs show for effect-driven data fetching; the stricter
    // set-state-in-effect lint rule flags it as a general heuristic, but
    // there's no way to derive "a new fetch just started" without it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)

    fetchers[activeTab]()
      .then((res) => {
        if (!cancelled) {
          setResult(res)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load the report')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, activeTab, period, dateFrom, dateTo, page])

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2b1b12] text-white">
          <ChartIcon />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-stone-800">Reports</h2>
          <p className="text-sm text-stone-500">Sales, catalog, and operations breakdowns</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab.id ? 'bg-amber-600 text-white' : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="my-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        {activeTab === 'sales' ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-stone-600">Period</span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as typeof period)}
              aria-label="Sales report period"
              className={inputClasses}
            >
              <option value="daily">Daily (last 30 days)</option>
              <option value="weekly">Weekly (last 12 weeks)</option>
              <option value="monthly">Monthly (last 12 months)</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Report date from"
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="Report date to"
            className={inputClasses}
          />
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={!result || isExporting}
          className="ml-auto flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40"
        >
          <DownloadIcon />
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {exportError ? (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {exportError}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : isLoading || !result ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        <ReportTable result={result} page={page} onPageChange={setPage} />
      )}
    </section>
  )
}

function ReportTable({ result, page, onPageChange }: { result: ReportData; page: number; onPageChange: (page: number) => void }) {
  if (result.tab === 'sales') {
    return (
      <Table headers={['Date', 'Orders', 'Sales', 'Discounts']}>
        {result.data.buckets.map((b) => (
          <tr key={b.date} className="border-b border-stone-100 last:border-0">
            <Td>{b.date}</Td>
            <Td>{b.orderCount}</Td>
            <Td>{formatCents(b.totalSales)}</Td>
            <Td>{formatCents(b.totalDiscounts)}</Td>
          </tr>
        ))}
      </Table>
    )
  }
  if (result.tab === 'products') {
    return (
      <Table headers={['Product', 'Quantity Sold', 'Revenue']}>
        {result.data.products.map((p) => (
          <tr key={p.productId} className="border-b border-stone-100 last:border-0">
            <Td>{p.name}</Td>
            <Td>{p.quantitySold}</Td>
            <Td>{formatCents(p.revenue)}</Td>
          </tr>
        ))}
      </Table>
    )
  }
  if (result.tab === 'categories') {
    return (
      <Table headers={['Category', 'Quantity Sold', 'Revenue']}>
        {result.data.categories.map((c) => (
          <tr key={c.categoryId} className="border-b border-stone-100 last:border-0">
            <Td>{c.name}</Td>
            <Td>{c.quantitySold}</Td>
            <Td>{formatCents(c.revenue)}</Td>
          </tr>
        ))}
      </Table>
    )
  }
  if (result.tab === 'cashiers') {
    return (
      <Table headers={['Cashier', 'Orders', 'Revenue']}>
        {result.data.cashiers.map((c) => (
          <tr key={c.cashierId} className="border-b border-stone-100 last:border-0">
            <Td>{c.name}</Td>
            <Td>{c.orderCount}</Td>
            <Td>{formatCents(c.revenue)}</Td>
          </tr>
        ))}
      </Table>
    )
  }
  if (result.tab === 'payment-methods') {
    return (
      <Table headers={['Method', 'Orders', 'Revenue']}>
        {result.data.methods.map((m) => (
          <tr key={m.method} className="border-b border-stone-100 last:border-0">
            <Td>{m.method}</Td>
            <Td>{m.orderCount}</Td>
            <Td>{formatCents(m.revenue)}</Td>
          </tr>
        ))}
      </Table>
    )
  }
  if (result.tab === 'discounts') {
    return (
      <Table headers={['Discount', 'Times Used', 'Total Discounted']}>
        {result.data.discounts.map((d) => (
          <tr key={d.name} className="border-b border-stone-100 last:border-0">
            <Td>{d.name}</Td>
            <Td>{d.timesUsed}</Td>
            <Td>{formatCents(d.totalDiscounted)}</Td>
          </tr>
        ))}
      </Table>
    )
  }
  if (result.tab === 'cancelled-orders') {
    const totalPages = Math.max(1, Math.ceil(result.data.total / result.data.pageSize))
    return (
      <>
        <Table headers={['Order', 'Status', 'Cashier', 'Total', 'Date']}>
          {result.data.orders.map((o) => (
            <tr key={o.id} className="border-b border-stone-100 last:border-0">
              <Td>{formatOrderNumber(o.sequenceNumber)}</Td>
              <Td>{o.status}</Td>
              <Td>{o.cashier.name}</Td>
              <Td>{formatCents(o.total)}</Td>
              <Td>{new Date(o.createdAt).toLocaleString()}</Td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      </>
    )
  }
  // inventory-movement
  const totalPages = Math.max(1, Math.ceil(result.data.total / result.data.pageSize))
  return (
    <>
      {result.data.summaryByType.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-3">
          {result.data.summaryByType.map((s) => (
            <span
              key={s.type}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 shadow-sm"
            >
              <span className="font-medium text-stone-800">{s.type}</span>{' '}
              <span className={s.quantityDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {s.quantityDelta > 0 ? '+' : ''}
                {s.quantityDelta}
              </span>{' '}
              ({s.transactionCount} txns)
            </span>
          ))}
        </div>
      ) : null}
      <Table headers={['Product', 'Type', 'Change', 'Balance After', 'Reason', 'By']}>
        {result.data.transactions.map((t) => (
          <tr key={t.id} className="border-b border-stone-100 last:border-0">
            <Td>{t.productName}</Td>
            <Td>{t.type}</Td>
            <Td>{t.quantityChange > 0 ? `+${t.quantityChange}` : t.quantityChange}</Td>
            <Td>{t.quantityAfter}</Td>
            <Td>{t.reason ?? '—'}</Td>
            <Td>{t.createdByName}</Td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 whitespace-nowrap text-stone-700">{children}</td>
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
