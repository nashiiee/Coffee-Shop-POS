import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { UsersIcon } from '../admin/icons'
import * as usersApi from './api'
import type { Cashier } from './types'

const inputClasses =
  'rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none'

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
      }`}
    >
      {isActive ? 'Active' : 'Disabled'}
    </span>
  )
}

interface ResetPasswordRowProps {
  cashier: Cashier
  onSubmit: (id: string, password: string) => Promise<void>
}

function ResetPasswordRow({ cashier, onSubmit }: ResetPasswordRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState('')

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="text-xs font-medium text-stone-500 hover:text-stone-700">
        Reset password
      </button>
    )
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit(cashier.id, password).then(() => {
          setPassword('')
          setIsOpen(false)
        })
      }}
    >
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="New password"
        aria-label={`New password for ${cashier.name}`}
        required
        minLength={8}
        className={`w-32 py-1 text-xs ${inputClasses}`}
      />
      <button type="submit" className="text-xs font-medium text-amber-700 hover:text-amber-800">
        Save
      </button>
      <button type="button" onClick={() => setIsOpen(false)} className="text-xs text-stone-400 hover:text-stone-600">
        Cancel
      </button>
    </form>
  )
}

export function UsersPage() {
  const { accessToken } = useAuth()
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function refetch() {
    setError(null)
    try {
      setCashiers(await usersApi.listCashiers(accessToken))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load cashiers')
    }
  }

  useEffect(() => {
    let cancelled = false
    usersApi
      .listCashiers(accessToken)
      .then((result) => {
        if (!cancelled) setCashiers(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load cashiers')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await usersApi.createCashier(accessToken, { name, email, password })
      setName('')
      setEmail('')
      setPassword('')
      await refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create cashier')
    }
  }

  async function handleToggleActive(cashier: Cashier) {
    setError(null)
    setBusyId(cashier.id)
    try {
      if (cashier.isActive) {
        await usersApi.disableUser(accessToken, cashier.id)
      } else {
        await usersApi.reactivateUser(accessToken, cashier.id)
      }
      await refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update cashier')
    } finally {
      setBusyId(null)
    }
  }

  async function handleResetPassword(id: string, newPassword: string) {
    setError(null)
    try {
      await usersApi.resetPassword(accessToken, id, newPassword)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password')
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2b1b12] text-white">
          <UsersIcon />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-stone-800">Cashiers</h2>
          <p className="text-sm text-stone-500">Create and manage cashier accounts</p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => void handleCreate(event)}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Name</span>
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            className={inputClasses}
          />
        </label>
        <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
          Create cashier
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : cashiers.length === 0 ? (
        <p className="text-sm text-stone-400">No cashiers yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cashiers.map((cashier) => (
                <tr key={cashier.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-800">{cashier.name}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-600">{cashier.email}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <StatusPill isActive={cashier.isActive} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={busyId === cashier.id}
                        onClick={() => void handleToggleActive(cashier)}
                        className={`text-xs font-medium disabled:opacity-50 ${
                          cashier.isActive ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'
                        }`}
                      >
                        {cashier.isActive ? 'Disable' : 'Reactivate'}
                      </button>
                      <ResetPasswordRow cashier={cashier} onSubmit={handleResetPassword} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
