import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { ClipboardIcon } from '../admin/icons'
import * as auditApi from './api'
import type { AuditLogEntry, AuditLogListResponse } from './types'

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

function formatState(state: unknown): string {
  if (state === null || state === undefined) return '—'
  return JSON.stringify(state)
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
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
      <td className="max-w-xs px-4 py-2.5 text-xs text-stone-500">
        {entry.previousState !== null && entry.previousState !== undefined ? (
          <p className="truncate" title={formatState(entry.previousState)}>
            <span className="text-stone-400">from:</span> {formatState(entry.previousState)}
          </p>
        ) : null}
        <p className="truncate" title={formatState(entry.newState)}>
          <span className="text-stone-400">to:</span> {formatState(entry.newState)}
        </p>
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
      </div>

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
