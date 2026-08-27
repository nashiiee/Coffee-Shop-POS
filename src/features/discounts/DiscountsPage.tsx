import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { dollarsToCents, formatCents } from '../../lib/money'
import * as discountsApi from './api'
import type { Discount } from './types'
import { DiscountIcon } from '../admin/icons'
import { useToast } from '../admin/useToast'

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
  nameInputRef?: React.RefObject<HTMLInputElement | null>
}

function DiscountFormFields({ values, onChange, labels, nameInputRef }: DiscountFormFieldsProps) {
  function handleTypeChange(nextType: DiscountType) {
    // A percentage-points value and a dollar amount are different units —
    // carrying the same numeric string over to the other type would submit
    // a silently wrong discount (e.g. "10" meaning 10% becomes ₱10.00 off).
    // Force re-entry instead of reinterpreting it.
    onChange({ ...values, type: nextType, value: '' })
  }

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">Name</span>
        <input
          ref={nameInputRef}
          type="text"
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
          placeholder="e.g. Staff Discount"
          aria-label={labels.name}
          required
          className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">Type</span>
        <select
          value={values.type}
          onChange={(event) => handleTypeChange(event.target.value as DiscountType)}
          aria-label={labels.type}
          className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none"
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">{values.type === 'PERCENTAGE' ? 'Percent off' : 'Amount off'}</span>
        <input
          type="number"
          step={values.type === 'PERCENTAGE' ? '1' : '0.01'}
          min="0"
          max={values.type === 'PERCENTAGE' ? '100' : undefined}
          value={values.value}
          onChange={(event) => onChange({ ...values, value: event.target.value })}
          aria-label={labels.value}
          required
          className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">Expires</span>
        <input
          type="date"
          value={values.expiresAt}
          onChange={(event) => onChange({ ...values, expiresAt: event.target.value })}
          aria-label={labels.expiresAt}
          className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none"
        />
      </label>
    </>
  )
}

// Matches ConfirmDialog.tsx's focus-trap selector — kept in sync
// deliberately rather than shared, both are small single-purpose modals.
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface AddDiscountModalProps {
  onCreate: (values: DiscountFormState) => Promise<void>
  onClose: () => void
}

function AddDiscountModal({ onCreate, onClose }: AddDiscountModalProps) {
  const [values, setValues] = useState<DiscountFormState>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
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
    await onCreate(values)
    setIsSubmitting(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-discount-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div ref={dialogRef} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 id="add-discount-title" className="mb-1 text-lg font-semibold text-stone-900">
          New discount
        </h2>
        <p className="mb-4 text-sm text-stone-500">Cashiers can apply this at checkout.</p>
        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-4">
          <DiscountFormFields
            values={values}
            onChange={setValues}
            nameInputRef={nameInputRef}
            labels={{ name: 'Discount name', type: 'Discount type', value: 'Discount value', expiresAt: 'Discount expiry date' }}
          />
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding…' : 'Add discount'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DiscountsPage() {
  const { accessToken } = useAuth()
  const { showToast } = useToast()
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
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

  async function handleCreate(values: DiscountFormState) {
    setError(null)
    try {
      await discountsApi.createDiscount(accessToken, {
        name: values.name,
        type: values.type,
        value: valueToCents(values.type, values.value),
        ...(values.expiresAt ? { expiresAt: new Date(values.expiresAt).toISOString() } : {}),
      })
      setIsAddOpen(false)
      showToast(`Discount "${values.name}" added`)
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
      <header className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-stone-900">Discounts</h2>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Add discount
        </button>
      </header>
      {error ? (
        <p role="alert" className="mb-3 text-red-600">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p>Loading…</p>
      ) : discounts.length === 0 ? (
        <p className="text-stone-400">No discounts yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {discounts.map((discount) =>
            editingId === discount.id ? (
              <li key={discount.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-3">
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
              <li
                key={discount.id}
                className={`flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md ${
                  discount.isActive ? '' : 'opacity-60'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                  <DiscountIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-800">{discount.name}</p>
                  <p className="text-sm text-stone-500">
                    {discount.type === 'PERCENTAGE' ? `${discount.value}% off` : `${formatCents(discount.value)} off`}
                    {discount.expiresAt ? ` · expires ${new Date(discount.expiresAt).toLocaleDateString()}` : ''}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      discount.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {discount.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(discount)}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleActive(discount)}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    {discount.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {isAddOpen ? <AddDiscountModal onCreate={handleCreate} onClose={() => setIsAddOpen(false)} /> : null}
    </section>
  )
}
