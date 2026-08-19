import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { dollarsToCents, formatCents } from '../../lib/money'
import * as discountsApi from './api'
import type { Discount } from './types'

type DiscountType = 'PERCENTAGE' | 'FIXED'

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

// PERCENTAGE stores whole points (0-100) directly; FIXED stores integer
// cents — the create/edit form's single "value" input means opposite ends
// so it must convert differently depending on the selected type.
function valueToCents(type: DiscountType, rawValue: string): number {
  if (type === 'PERCENTAGE') return Math.round(Number(rawValue))
  return dollarsToCents(rawValue)
}

function valueToInputString(discount: Discount): string {
  return discount.type === 'PERCENTAGE' ? String(discount.value) : (discount.value / 100).toFixed(2)
}

interface DiscountFormState {
  name: string
  type: DiscountType
  value: string
  expiresAt: string
}

const emptyForm: DiscountFormState = { name: '', type: 'PERCENTAGE', value: '', expiresAt: '' }

interface DiscountFormFieldsProps {
  values: DiscountFormState
  onChange: (next: DiscountFormState) => void
  labels: { name: string; type: string; value: string; expiresAt: string }
}

function DiscountFormFields({ values, onChange, labels }: DiscountFormFieldsProps) {
  function handleTypeChange(nextType: DiscountType) {
    // A percentage-points value and a dollar amount are different units —
    // carrying the same numeric string over to the other type would submit
    // a silently wrong discount (e.g. "10" meaning 10% becomes ₱10.00 off).
    // Force re-entry instead of reinterpreting it.
    onChange({ ...values, type: nextType, value: '' })
  }

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Name</span>
        <input
          type="text"
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
          placeholder="e.g. Staff Discount"
          aria-label={labels.name}
          required
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Type</span>
        <select
          value={values.type}
          onChange={(event) => handleTypeChange(event.target.value as DiscountType)}
          aria-label={labels.type}
          className="rounded border px-3 py-2"
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{values.type === 'PERCENTAGE' ? 'Percent off' : 'Amount off'}</span>
        <input
          type="number"
          step={values.type === 'PERCENTAGE' ? '1' : '0.01'}
          min="0"
          max={values.type === 'PERCENTAGE' ? '100' : undefined}
          value={values.value}
          onChange={(event) => onChange({ ...values, value: event.target.value })}
          aria-label={labels.value}
          required
          className="w-28 rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Expires</span>
        <input
          type="date"
          value={values.expiresAt}
          onChange={(event) => onChange({ ...values, expiresAt: event.target.value })}
          aria-label={labels.expiresAt}
          className="rounded border px-3 py-2"
        />
      </label>
    </>
  )
}

export function DiscountsPage() {
  const { accessToken } = useAuth()
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [form, setForm] = useState<DiscountFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<DiscountFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function refresh() {
    const result = await discountsApi.listDiscounts(accessToken)
    setDiscounts(result)
  }

  useEffect(() => {
    let cancelled = false
    discountsApi
      .listDiscounts(accessToken)
      .then((result) => {
        if (!cancelled) setDiscounts(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load discounts')
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
      await discountsApi.createDiscount(accessToken, {
        name: form.name,
        type: form.type,
        value: valueToCents(form.type, form.value),
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
      })
      setForm(emptyForm)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create discount')
    }
  }

  function startEdit(discount: Discount) {
    setEditingId(discount.id)
    setEditForm({
      name: discount.name,
      type: discount.type,
      value: valueToInputString(discount),
      expiresAt: toDateInputValue(discount.expiresAt),
    })
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId) return
    setError(null)
    try {
      await discountsApi.updateDiscount(accessToken, editingId, {
        name: editForm.name,
        type: editForm.type,
        value: valueToCents(editForm.type, editForm.value),
        // Explicit null clears a previously-set expiry — the input is
        // empty either way, so there's no other way to distinguish "leave
        // as-is" from "remove the expiry" once editing that field at all.
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
      })
      setEditingId(null)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update discount')
    }
  }

  async function toggleActive(discount: Discount) {
    setError(null)
    try {
      await discountsApi.updateDiscount(accessToken, discount.id, { isActive: !discount.isActive })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update discount')
    }
  }

  return (
    <section>
      <h2 className="mb-4 text-xl font-semibold">Discounts</h2>
      {error ? (
        <p role="alert" className="mb-3 text-red-600">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleCreate} noValidate className="mb-6 flex flex-wrap items-end gap-2">
        <DiscountFormFields
          values={form}
          onChange={setForm}
          labels={{ name: 'Discount name', type: 'Discount type', value: 'Discount value', expiresAt: 'Discount expiry date' }}
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Add discount
        </button>
      </form>

      {isLoading ? (
        <p>Loading…</p>
      ) : discounts.length === 0 ? (
        <p>No discounts yet.</p>
      ) : (
        <ul className="divide-y rounded border">
          {discounts.map((discount) =>
            editingId === discount.id ? (
              <li key={discount.id} className="px-4 py-3">
                <form onSubmit={handleSaveEdit} noValidate className="flex flex-wrap items-end gap-2">
                  <DiscountFormFields
                    values={editForm}
                    onChange={setEditForm}
                    labels={{
                      name: `Edit name for ${discount.name}`,
                      type: `Edit type for ${discount.name}`,
                      value: `Edit value for ${discount.name}`,
                      expiresAt: `Edit expiry for ${discount.name}`,
                    }}
                  />
                  <button type="submit" className="rounded bg-black px-4 py-2 text-white">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded border px-4 py-2">
                    Cancel
                  </button>
                </form>
              </li>
            ) : (
              <li key={discount.id} className="flex items-center justify-between px-4 py-2">
                <span>
                  {discount.name} —{' '}
                  {discount.type === 'PERCENTAGE' ? `${discount.value}%` : formatCents(discount.value)} off
                  {discount.expiresAt ? ` (expires ${new Date(discount.expiresAt).toLocaleDateString()})` : ''}{' '}
                  {discount.isActive ? null : <span className="text-gray-500">(inactive)</span>}
                </span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => startEdit(discount)} className="text-sm underline">
                    Edit
                  </button>
                  <button type="button" onClick={() => void toggleActive(discount)} className="text-sm underline">
                    {discount.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}
