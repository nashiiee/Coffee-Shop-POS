import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import type { Role } from '../features/auth/types'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: Role[]
}

/**
 * UX-only gate. The server independently enforces authorization on every
 * request — this component only avoids rendering UI the user shouldn't see.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />

  return <>{children}</>
}
