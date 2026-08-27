import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { formatCents } from '../../lib/money'
import { dateStampedFilename, exportCsv } from '../../lib/csv'
import { ClipboardIcon, DownloadIcon } from '../admin/icons'
import * as auditApi from './api'
import type { AuditLogEntry, AuditLogFilters, AuditLogListResponse } from './types'

const inputClasses =
  'rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none'

const AUDIT_ACTIONS = [
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRICE_CHANGED',
  'INVENTORY_ADJUSTED',
  'USER_CREATED',
  'USER_DISABLED',
  'USER_REACTIVATED',
  'USER_PASSWORD_RESET',
  'ROLE_CHANGED',
  'DISCOUNT_CREATED',
  'DISCOUNT_UPDATED',
  'CONFIG_CHANGED',
]

function formatAction(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Maps the raw field keys stored in previousState/newState (matching the
// database column or API payload names) to labels a non-technical admin
// can read at a glance.
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  categoryId: 'Category',
  parentId: 'Parent Category',
  basePrice: 'Price',
  price: 'Price',
  isActive: 'Active',
  type: 'Type',
  value: 'Value',
  quantityOnHand: 'Stock on Hand',
  reason: 'Reason',
  status: 'Status',
  email: 'Email',
  role: 'Role',
  sortOrder: 'Sort Order',
  expiresAt: 'Expires',
}

// basePrice/price are always stored in cents; a bare "Value" is only money
// when the sibling "type" field says so (a discount's value is a percentage
// when type is PERCENTAGE, cents when FIXED — see server/prisma/schema.prisma).
const MONEY_FIELDS = new Set(['basePrice', 'price'])
const ID_FIELDS = new Set(['categoryId', 'parentId'])
const ENUM_VALUE_PATTERN = /^[A-Z][A-Z0-9_]*$/

function humanizeLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase())
}

function humanizeEnumValue(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatFieldValue(key: string, value: unknown, discountType: string | undefined): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (key === 'value' && discountType) {
    return discountType === 'PERCENTAGE' ? `${value}%` : formatCents(Number(value))
  }
  if (MONEY_FIELDS.has(key) && typeof value === 'number') return formatCents(value)
  if (ID_FIELDS.has(key) && typeof value === 'string') return `#${value.slice(0, 8)}`
  if (typeof value === 'string' && ENUM_VALUE_PATTERN.test(value)) return humanizeEnumValue(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

interface ChangeLine {
  key: string
  label: string
  from: string | null
  to: string
}

// previousState/newState only ever contain the fields that actually
// changed (see product.service.ts, users.service.ts, etc.), so a plain
// "field: before → after" line per key is enough — no need to diff full
// objects.
function describeChanges(entry: AuditLogEntry): ChangeLine[] {
  const hasPrevious = entry.previousState !== null && entry.previousState !== undefined
  const before = (entry.previousState ?? {}) as Record<string, unknown>
  const after = (entry.newState ?? {}) as Record<string, unknown>
  const discountType = (after.type ?? before.type) as string | undefined
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))

  return keys.map((key) => ({
    key,
    label: humanizeLabel(key),
    from: hasPrevious && key in before ? formatFieldValue(key, before[key], discountType) : null,
    to: formatFieldValue(key, after[key], discountType),
  }))
}

function changesToText(entry: AuditLogEntry): string {
  return describeChanges(entry)
    .map((change) => (change.from !== null ? `${change.label}: ${change.from} → ${change.to}` : `${change.label}: ${change.to}`))
    .join('; ')
}

const AUDIT_EXPORT_PAGE_SIZE = 100 // matches the server's max pageSize (see audit.schema.ts)

// The visible table only holds one page — export needs every log entry
// matching the current filters, so this pages through as many requests as
// it takes and concatenates them.
async function fetchAllAuditLogs(accessToken: string | null, filters: AuditLogFilters): Promise<AuditLogEntry[]> {
  const first = await auditApi.listAuditLogs(accessToken, { ...filters, page: 1, pageSize: AUDIT_EXPORT_PAGE_SIZE })
  const logs = [...first.logs]
  const totalPages = Math.ceil(first.total / AUDIT_EXPORT_PAGE_SIZE)
  for (let page = 2; page <= totalPages; page++) {
    const next = await auditApi.listAuditLogs(accessToken, { ...filters, page, pageSize: AUDIT_EXPORT_PAGE_SIZE })
    logs.push(...next.logs)
  }
  return logs
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const changes = describeChanges(entry)
  return (
    <tr className="border-b border-stone-100 last:border-0 align-top">
      <td className="px-4 py-2.5 whitespace-nowrap text-stone-600">{new Date(entry.createdAt).toLocaleString()}</td>
      <td className="px-4 py-2.5 whitespace-nowrap text-stone-800">{entry.actorName}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{formatAction(entry.action)}</span>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap text-stone-600">
        {entry.resource} <span className="text-stone-400">#{entry.resourceId.slice(0, 8)}</span>
      </td>
      <td className="max-w-xs px-4 py-2.5 text-xs text-stone-600">
        {changes.length === 0 ? (
          <span className="text-stone-400">—</span>
        ) : (
          changes.map((change) => (
            <p key={change.key} className="leading-relaxed">
              <span className="font-medium text-stone-700">{change.label}:</span>{' '}
              {change.from !== null ? (
                <>
                  <span className="text-stone-400 line-through">{change.from}</span>{' '}
                  <span className="text-stone-400">→</span> <span className="text-stone-800">{change.to}</span>
                </>
              ) : (
                <span className="text-stone-800">{change.to}</span>
              )}
            </p>
          ))
        )}
      </td>
    </tr>
  )
}

export function AuditLogPage() {
  const { accessToken } = useAuth()
  const [action, setAction] = useState('')
  const [resource, setResource] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [result, setResult] = useState<AuditLogListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)

    auditApi
      .listAuditLogs(accessToken, { action: action || undefined, resource: resource || undefined, dateFrom, dateTo, page, pageSize })
      .then((res) => {
        if (!cancelled) {
          setResult(res)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load audit logs')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, action, resource, dateFrom, dateTo, page])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  async function handleExport() {
    setIsExporting(true)
    setExportError(null)
    try {
      const logs = await fetchAllAuditLogs(accessToken, { action: action || undefined, resource: resource || undefined, dateFrom, dateTo })
      const headers = ['Time', 'Actor', 'Action', 'Resource', 'Resource ID', 'Change']
      const rows = logs.map((entry) => [
        new Date(entry.createdAt).toLocaleString(),
        entry.actorName,
        formatAction(entry.action),
        entry.resource,
        entry.resourceId,
        changesToText(entry),
      ])
      exportCsv(dateStampedFilename('audit-log'), headers, rows)
    } catch (err: unknown) {
      setExportError(err instanceof ApiError ? err.message : 'Failed to export audit log')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2b1b12] text-white">
          <ClipboardIcon />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-stone-800">Audit Log</h2>
          <p className="text-sm text-stone-500">A record of who changed what, and when</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Action</span>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            className={inputClasses}
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {formatAction(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Resource</span>
          <input
            type="text"
            value={resource}
            onChange={(event) => {
              setResource(event.target.value)
              setPage(1)
            }}
            placeholder="e.g. Product"
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value)
              setPage(1)
            }}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value)
              setPage(1)
            }}
            className={inputClasses}
          />
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={!result || result.total === 0 || isExporting}
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
      ) : result.logs.length === 0 ? (
        <p className="text-sm text-stone-400">No matching audit entries.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">Actor</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Resource</th>
                  <th className="px-4 py-2.5 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {result.logs.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
