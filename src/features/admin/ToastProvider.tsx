import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from './toastContext'

const TOAST_DURATION_MS = 3000

interface ToastEntry {
  id: string
  message: string
}

// Small standalone checkmark glyph matching icons.tsx's line style (stroke
// 1.75, round caps/joins) — not added to icons.tsx itself since that file is
// scoped to the sidebar/category icon set, not generic UI feedback.
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timeouts = timeoutsRef.current
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId))
      timeouts.clear()
    }
  }, [])

  const showToast = useCallback((message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message }])

    const timeoutId = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      timeoutsRef.current.delete(id)
    }, TOAST_DURATION_MS)
    timeoutsRef.current.set(id, timeoutId)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="toast-enter flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-xl"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckIcon />
            </span>
            <span className="text-sm font-medium text-stone-800">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
