import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import { ApiError } from '../../lib/apiClient'
import { CupIcon } from '../admin/icons'

// Staggered so the three wisps drift up out of sync, not in unison.
const STEAM_DELAYS = [0, 0.9, 1.8]

export function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isLoading && user) {
    const requested = (location.state as { from?: string } | null)?.from
    // Only ever redirect to a same-app relative path — never follow an
    // externally-influenced value to an absolute or protocol-relative URL.
    const from = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login({ email, password })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#1c140d] px-6 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(232,147,90,0.16),transparent_60%)]"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="flex flex-col items-center" aria-hidden="true">
          <div className="mb-1.5 flex h-4 items-end justify-center gap-2.5">
            {STEAM_DELAYS.map((delay) => (
              <svg
                key={delay}
                viewBox="0 0 8 16"
                className="steam-wisp h-4 w-2 text-[#E8935A]/60"
                style={{ animationDelay: `${delay}s` }}
              >
                <path
                  d="M4 16c2-3 2-6 0-9s-2-6 0-9"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            ))}
          </div>
          <CupIcon className="h-9 w-9 text-[#E8935A]" />
        </div>

        <h1 className="font-display mt-3 text-4xl font-medium text-white">Culture Cup</h1>
        <p className="mt-2 text-sm text-white/50">Sign in to start your shift</p>

        <div className="login-card-enter mt-8 w-full rounded-3xl bg-[#FBF7F0] p-8 shadow-2xl shadow-black/40">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-[0.08em] text-stone-500 uppercase">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-base text-stone-800 focus:border-[#E8935A] focus:ring-2 focus:ring-[#E8935A]/40 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-[0.08em] text-stone-500 uppercase">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-base text-stone-800 focus:border-[#E8935A] focus:ring-2 focus:ring-[#E8935A]/40 focus:outline-none"
              />
            </label>
            {error ? (
              <p role="alert" className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-xl bg-[#201810] py-3.5 text-base font-medium text-white transition hover:bg-[#2b2016] disabled:opacity-50"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
