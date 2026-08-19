import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { dollarsToCents, formatCents } from '../../lib/money'
import * as catalogApi from './api'
import type { Modifier } from './types'

export function ModifiersPage() {
  const { accessToken } = useAuth()
  const [modifiers, setModifiers] = useState<Modifier[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function refresh() {
    const result = await catalogApi.listModifiers(accessToken)
    setModifiers(result)
  }

  useEffect(() => {
    let cancelled = false
    catalogApi
      .listModifiers(accessToken)
      .then((result) => {
        if (!cancelled) setModifiers(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load modifiers')
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
      await catalogApi.createModifier(accessToken, { name, price: dollarsToCents(price) })
      setName('')
      setPrice('')
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create modifier')
    }
  }

  async function toggleActive(modifier: Modifier) {
    setError(null)
    try {
      await catalogApi.updateModifier(accessToken, modifier.id, { isActive: !modifier.isActive })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update modifier')
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Modifiers</h2>
      {error ? <p role="alert" className="mb-3 text-red-600">{error}</p> : null}

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Extra Shot"
          aria-label="Modifier name"
          required
          className="rounded border px-3 py-2"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Price"
          aria-label="Modifier price"
          required
          className="w-28 rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Add modifier
        </button>
      </form>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <ul className="divide-y rounded border">
          {modifiers.map((modifier) => (
            <li key={modifier.id} className="flex items-center justify-between px-4 py-2">
              <span>
                {modifier.name} — {formatCents(modifier.price)}{' '}
                {modifier.isActive ? null : <span className="text-gray-500">(inactive)</span>}
              </span>
              <button type="button" onClick={() => void toggleActive(modifier)} className="text-sm underline">
                {modifier.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
