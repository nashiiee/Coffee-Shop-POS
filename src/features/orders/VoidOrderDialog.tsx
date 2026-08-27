import { useEffect, useRef, useState } from 'react'

interface VoidOrderDialogProps {
  title: string
  actionLabel: string
  onConfirm: (reason: string) => void
  onCancel: () => void
  isSubmitting?: boolean
  // Shown inside the dialog (not on the page behind it) — the dialog's own
  // backdrop would otherwise hide a page-level error banner from view.
  error?: string | null
}

// Mirrors pos/ConfirmDialog.tsx's focus-trap pattern, extended with a
// required reason field — cancel/refund always needs a documented reason
// (see order.schema.ts's voidOrderSchema, min length 3), so this can't just
// be a title/message confirm like ConfirmDialog.
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
const MIN_REASON_LENGTH = 3

export function VoidOrderDialog({ title, actionLabel, onConfirm, onCancel, isSubmitting = false, error = null }: VoidOrderDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
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
  }, [onCancel])

  const trimmedReason = reason.trim()
  const canSubmit = trimmedReason.length >= MIN_REASON_LENGTH && !isSubmitting

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="void-order-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="void-order-dialog-title" className="mb-4 text-lg font-semibold">
          {title}
        </h2>
        <label className="mb-4 flex flex-col gap-1">
          <span className="text-sm font-medium text-stone-700">Reason (required)</span>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="e.g. Customer requested a refund — item was cold on arrival"
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
          />
        </label>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 text-base hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => canSubmit && onConfirm(trimmedReason)}
            disabled={!canSubmit}
            className="rounded-lg bg-red-600 px-4 py-2 text-base font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            {isSubmitting ? 'Processing…' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
