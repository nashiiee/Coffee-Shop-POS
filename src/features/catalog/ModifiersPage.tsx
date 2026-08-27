import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { dollarsToCents, formatCents } from '../../lib/money'
import * as catalogApi from './api'
import type { Modifier } from './types'
import { ModifierIcon } from '../admin/icons'
import { useToast } from '../admin/useToast'

// Matches ConfirmDialog.tsx's focus-trap selector — kept in sync
// deliberately rather than shared, both are small single-purpose modals.
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface AddModifierModalProps {
  onCreate: (name: string, price: string) => Promise<void>
  onClose: () => void
}

function AddModifierModal({ onCreate, onClose }: AddModifierModalProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    await onCreate(name, price)
    setIsSubmitting(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-modifier-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div ref={dialogRef} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 id="add-modifier-title" className="mb-1 text-lg font-semibold text-stone-900">
          New modifier
        </h2>
        <p className="mb-4 text-sm text-stone-500">An add-on cashiers can attach to a product, like an extra shot or plant milk.</p>
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-stone-700">Name</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Extra Shot"
              aria-label="Modifier name"
              required
              className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-stone-700">Price</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
              aria-label="Modifier price"
              required
              className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none"
            />
          </label>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding…' : 'Add modifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ModifiersPage() {
  const { accessToken } = useAuth()
  const { showToast } = useToast()
  const [modifiers, setModifiers] = useState<Modifier[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
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

  async function handleCreate(name: string, price: string) {
    setError(null)
    try {
      await catalogApi.createModifier(accessToken, { name, price: dollarsToCents(price) })
      setIsAddOpen(false)
      showToast(`Modifier "${name}" added`)
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
      <header className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-stone-900">Modifiers</h2>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Add modifier
        </button>
      </header>
      {error ? (
        <p role="alert" className="mb-3 text-red-600">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p>Loading…</p>
      ) : modifiers.length === 0 ? (
        <p className="text-stone-400">No modifiers yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modifiers.map((modifier) => (
            <li
              key={modifier.id}
              className={`flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md ${
                modifier.isActive ? '' : 'opacity-60'
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                <ModifierIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-800">{modifier.name}</p>
                <p className="text-sm text-stone-500">{formatCents(modifier.price)}</p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    modifier.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {modifier.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void toggleActive(modifier)}
                className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                {modifier.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isAddOpen ? <AddModifierModal onCreate={handleCreate} onClose={() => setIsAddOpen(false)} /> : null}
    </section>
  )
}
