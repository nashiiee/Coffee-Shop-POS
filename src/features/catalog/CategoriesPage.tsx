import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import * as catalogApi from './api'
import type { Category } from './types'

export function CategoriesPage() {
  const { accessToken } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await catalogApi.createCategory(accessToken, { name })
      setName('')
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
      <h2 className="mb-4 text-xl font-semibold">Categories</h2>
      {error ? <p role="alert" className="mb-3 text-red-600">{error}</p> : null}

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New category name"
          aria-label="Category name"
          required
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Add category
        </button>
      </form>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <ul className="divide-y rounded border">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between px-4 py-2">
              <span>
                {category.name} {category.isActive ? null : <span className="text-gray-500">(inactive)</span>}
              </span>
              <button type="button" onClick={() => void toggleActive(category)} className="text-sm underline">
                {category.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
