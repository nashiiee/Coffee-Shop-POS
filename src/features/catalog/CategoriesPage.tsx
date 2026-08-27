import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import * as catalogApi from './api'
import type { Category } from './types'
import { iconForCategory } from '../admin/categoryIcons'
import { useToast } from '../admin/useToast'

// Matches ConfirmDialog.tsx's focus-trap selector — kept in sync
// deliberately rather than shared, both are small single-purpose modals.
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface AddCategoryModalProps {
  onCreate: (name: string) => Promise<void>
  onClose: () => void
}

function AddCategoryModal({ onCreate, onClose }: AddCategoryModalProps) {
  const [name, setName] = useState('')
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
    await onCreate(name)
    setIsSubmitting(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-category-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div ref={dialogRef} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 id="add-category-title" className="mb-1 text-lg font-semibold text-stone-900">
          New category
        </h2>
        <p className="mb-4 text-sm text-stone-500">Give it a clear, customer-facing name — it'll show up in the POS category rail.</p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-stone-700">Category name</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Coffee"
              aria-label="Category name"
              required
              className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none"
            />
          </label>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding…' : 'Add category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CategoriesPage() {
  const { accessToken } = useAuth()
  const { showToast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function refresh() {
    const result = await catalogApi.listCategories(accessToken)
    setCategories(result)
  }

  useEffect(() => {
    let cancelled = false
    catalogApi
      .listCategories(accessToken)
      .then((result) => {
        if (!cancelled) setCategories(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load categories')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  async function handleCreate(name: string) {
    setError(null)
    try {
      await catalogApi.createCategory(accessToken, { name })
      setIsAddOpen(false)
      showToast(`Category "${name}" added`)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create category')
    }
  }

  async function toggleActive(category: Category) {
    setError(null)
    try {
      await catalogApi.updateCategory(accessToken, category.id, { isActive: !category.isActive })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update category')
    }
  }

  return (
    <section>
      <header className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-stone-900">Categories</h2>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Add category
        </button>
      </header>
      {error ? (
        <p role="alert" className="mb-3 text-red-600">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p>Loading…</p>
      ) : categories.length === 0 ? (
        <p className="text-stone-400">No categories yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const Icon = iconForCategory(category.name)
            return (
              <li
                key={category.id}
                className={`flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md ${
                  category.isActive ? '' : 'opacity-60'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                  <Icon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-800">{category.name}</p>
                  <span
                    className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      category.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {category.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleActive(category)}
                  className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  {category.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {isAddOpen ? <AddCategoryModal onCreate={handleCreate} onClose={() => setIsAddOpen(false)} /> : null}
    </section>
  )
}
