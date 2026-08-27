import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from './api'
import type { LoginRequest, Shop, User } from './types'
import { AuthContext } from './authContext'

// Refresh this long before the access token's own `exp`, so the renewal
// lands with margin instead of racing the token's actual expiry.
// apiClient.ts has no reactive 401-refresh-retry, so if this timer doesn't
// fire before exp, every API call fails outright until a full page reload
// re-triggers the mount-time refresh() below — losing whatever the cashier
// had in progress (e.g. an in-memory cart).
const REFRESH_MARGIN_MS = 60_000

// Reads the `exp` claim (seconds since epoch) out of a JWT's payload segment
// without verifying the signature — verification is the server's job on
// every request regardless. This is only used client-side to decide when to
// proactively renew, so a malformed/unreadable token just disables proactive
// renewal (falls back to the prior mount-only-refresh behavior) rather than
// throwing.
function getTokenExpiryMs(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const decoded = JSON.parse(atob(padded)) as { exp?: number }
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    authApi
      .refresh()
      .then((result) => {
        if (cancelled) return
        setUser(result.user)
        setShop(result.shop)
        setAccessToken(result.accessToken)
      })
      .catch(() => {
        // No valid refresh cookie yet — user is simply signed out.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Proactively renews the access token before it expires. Keyed on
  // accessToken itself rather than a recursive self-scheduling callback: a
  // successful renewal calls setAccessToken with the new token, which
  // re-runs this same effect and schedules the next renewal from the new
  // token's own `exp` — no manual re-scheduling needed. Also fires (and
  // does nothing but clean up) whenever accessToken becomes null, e.g. on
  // logout.
  useEffect(() => {
    if (!accessToken) return

    const expiryMs = getTokenExpiryMs(accessToken)
    if (expiryMs === null) return

    // Guards the in-flight refresh() call itself, not just the timer — once
    // the timeout fires, clearTimeout can no longer stop it. Without this,
    // an unmount (or a newer token superseding this effect) while the
    // request is still in flight would let a stale response resurrect a
    // signed-out session. Mirrors the mount effect's own `cancelled` guard.
    let cancelled = false

    const delay = Math.max(0, expiryMs - Date.now() - REFRESH_MARGIN_MS)
    const timer = setTimeout(() => {
      authApi
        .refresh()
        .then((result) => {
          if (cancelled) return
          setUser(result.user)
          setShop(result.shop)
          setAccessToken(result.accessToken)
        })
        .catch(() => {
          if (cancelled) return
          // Refresh cookie itself is gone/expired (7-day TTL) or the
          // account was disabled — sign out cleanly instead of leaving
          // every subsequent API call failing with a stale-token error.
          setUser(null)
          setShop(null)
          setAccessToken(null)
        })
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [accessToken])

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await authApi.login(credentials)
    setUser(result.user)
    setShop(result.shop)
    setAccessToken(result.accessToken)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Best-effort: local auth state is cleared below regardless of
      // whether the server call succeeds (e.g. network failure).
    } finally {
      setUser(null)
      setShop(null)
      setAccessToken(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, shop, accessToken, isLoading, login, logout }),
    [user, shop, accessToken, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
