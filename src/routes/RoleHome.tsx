import { Navigate } from 'react-router'
import { useAuth } from '../features/auth/useAuth'

export function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/pos'} replace />
}
