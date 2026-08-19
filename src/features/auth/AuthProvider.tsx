import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from './api'
import type { LoginRequest, User } from './types'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    authApi
      .refresh()
      .then((result) => {
        if (cancelled) return
        setUser(result.user)
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

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await authApi.login(credentials)
    setUser(result.user)
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
      setAccessToken(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, accessToken, isLoading, login, logout }),
    [user, accessToken, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
