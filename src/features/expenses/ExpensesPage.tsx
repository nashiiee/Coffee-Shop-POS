import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../../lib/apiClient'
import { dollarsToCents, formatCents } from '../../lib/money'
import { StatTile } from '../admin/StatTile'
import { WalletIcon, CalendarIcon, CoinIcon, TrendDownIcon } from '../admin/icons'
import { useToast } from '../admin/useToast'
import * as expensesApi from './api'
import type { Expense } from './types'

const CATEGORY_SUGGESTIONS = ['Rent', 'Utilities', 'Ingredients & Supplies', 'Payroll', 'Equipment', 'Marketing', 'Maintenance', 'Other']

const inputClasses =
  'rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none'

interface ExpenseFormState {
  description: string
  category: string
  amount: string
  incurredAt: string
  note: string
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm: ExpenseFormState = { description: '', category: '', amount: '', incurredAt: todayInputValue(), note: '' }

function expenseToForm(expense: Expense): ExpenseFormState {
  return {
    description: expense.description,
    category: expense.category,
    amount: (expense.amount / 100).toFixed(2),
    incurredAt: expense.incurredAt.slice(0, 10),
    note: expense.note ?? '',
  }
}

// Matches ConfirmDialog.tsx / DiscountsPage.tsx's focus-trap selector — kept
// in sync deliberately rather than shared, all are small single-purpose modals.
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface ExpenseFormModalProps {
  title: string
  submitLabel: string
  initialValues: ExpenseFormState
  onSubmit: (values: ExpenseFormState) => Promise<void>
  onClose: () => void
}

function ExpenseFormModal({ title, submitLabel, initialValues, onSubmit, onClose }: ExpenseFormModalProps) {
  const [values, setValues] = useState<ExpenseFormState>(initialValues)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const descriptionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    descriptionInputRef.current?.focus()
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
    await onSubmit(values)
    setIsSubmitting(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div ref={dialogRef} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 id="expense-form-title" className="mb-4 text-lg font-semibold text-stone-900">
          {title}
        </h2>
        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-stone-700">Description</span>
            <input
              ref={descriptionInputRef}
              type="text"
              value={values.description}
              onChange={(event) => setValues({ ...values, description: event.target.value })}
              placeholder="e.g. Milk delivery"
              required
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-stone-700">Category</span>
            <input
              type="text"
              list="expense-category-suggestions"
              value={values.category}
              onChange={(event) => setValues({ ...values, category: event.target.value })}
              placeholder="e.g. Supplies"
              required
              className={inputClasses}
            />
            <datalist id="expense-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">Amount</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.amount}
                onChange={(event) => setValues({ ...values, amount: event.target.value })}
                required
                className={inputClasses}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">Date</span>
              <input
                type="date"
                value={values.incurredAt}
                onChange={(event) => setValues({ ...values, incurredAt: event.target.value })}
                required
                className={inputClasses}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-stone-700">Note (optional)</span>
            <textarea
              value={values.note}
              onChange={(event) => setValues({ ...values, note: event.target.value })}
              rows={2}
              className={`${inputClasses} resize-none`}
            />
          </label>
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ExpensesPage() {
  const { accessToken } = useAuth()
  const { showToast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [category, setCategory] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function refresh() {
    const result = await expensesApi.listExpenses(accessToken, { dateFrom, dateTo, category })
    setExpenses(result)
  }

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    expensesApi
      .listExpenses(accessToken, { dateFrom, dateTo, category })
      .then((result) => {
        if (!cancelled) {
          setExpenses(result)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load expenses')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, dateFrom, dateTo, category])

  const categoryOptions = useMemo(() => Array.from(new Set(expenses.map((e) => e.category))).sort(), [expenses])

  const { totalThisMonth, totalToday, topCategory } = useMemo(() => {
    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)
    let monthTotal = 0
    let todayTotal = 0
    const byCategory = new Map<string, number>()
    for (const expense of expenses) {
      const incurred = new Date(expense.incurredAt)
      if (incurred.getFullYear() === now.getFullYear() && incurred.getMonth() === now.getMonth()) {
        monthTotal += expense.amount
        byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount)
      }
      if (expense.incurredAt.slice(0, 10) === todayKey) {
        todayTotal += expense.amount
      }
    }
    let leader: { category: string; amount: number } | null = null
    for (const [cat, amount] of byCategory) {
      if (!leader || amount > leader.amount) leader = { category: cat, amount }
    }
    return { totalThisMonth: monthTotal, totalToday: todayTotal, topCategory: leader }
  }, [expenses])

  async function handleCreate(values: ExpenseFormState) {
    setError(null)
    try {
      await expensesApi.createExpense(accessToken, {
        description: values.description,
        category: values.category,
        amount: dollarsToCents(values.amount),
        incurredAt: new Date(values.incurredAt).toISOString(),
        ...(values.note ? { note: values.note } : {}),
      })
      setIsAddOpen(false)
      showToast(`Expense "${values.description}" added`)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create expense')
    }
  }

  async function handleSaveEdit(values: ExpenseFormState) {
    if (!editingExpense) return
    setError(null)
    try {
      await expensesApi.updateExpense(accessToken, editingExpense.id, {
        description: values.description,
        category: values.category,
        amount: dollarsToCents(values.amount),
        incurredAt: new Date(values.incurredAt).toISOString(),
        note: values.note || null,
      })
      setEditingExpense(null)
      showToast('Expense updated')
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update expense')
    }
  }

  async function handleDelete(expense: Expense) {
    if (!window.confirm(`Delete "${expense.description}"? This can't be undone.`)) return
    setError(null)
    try {
      await expensesApi.deleteExpense(accessToken, expense.id)
      showToast('Expense deleted')
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete expense')
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2b1b12] text-white">
            <WalletIcon />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-stone-800">Expenses</h2>
            <p className="text-sm text-stone-500">Track rent, supplies, payroll, and other operating costs</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          Add expense
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="This Month" Icon={CoinIcon} tone="primary" value={formatCents(totalThisMonth)} />
        <StatTile label="Today" Icon={CalendarIcon} tone="info" value={formatCents(totalToday)} />
        <StatTile
          label="Top Category (This Month)"
          Icon={TrendDownIcon}
          tone="alert"
          value={topCategory ? topCategory.category : '—'}
          footnote={topCategory ? <p className="mb-1 text-xs text-stone-400">{formatCents(topCategory.amount)} spent</p> : null}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">From</span>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">To</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-600">Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClasses}>
            <option value="">All categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
        {dateFrom || dateTo || category ? (
          <button
            type="button"
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              setCategory('')
            }}
            className="text-sm text-stone-500 underline"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400 shadow-sm">
          No expenses recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Added by</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-stone-600">{new Date(expense.incurredAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">{expense.category}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-800">
                    {expense.description}
                    {expense.note ? <span className="block text-xs text-stone-400">{expense.note}</span> : null}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap text-stone-800">{formatCents(expense.amount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-stone-500">{expense.createdBy.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingExpense(expense)}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(expense)}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAddOpen ? (
        <ExpenseFormModal
          title="New expense"
          submitLabel="Add expense"
          initialValues={emptyForm}
          onSubmit={handleCreate}
          onClose={() => setIsAddOpen(false)}
        />
      ) : null}

      {editingExpense ? (
        <ExpenseFormModal
          title={`Edit "${editingExpense.description}"`}
          submitLabel="Save changes"
          initialValues={expenseToForm(editingExpense)}
          onSubmit={handleSaveEdit}
          onClose={() => setEditingExpense(null)}
        />
      ) : null}
    </section>
  )
}
