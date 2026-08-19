import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthContext } from '../features/auth/authContext'
import type { Role, User } from '../features/auth/types'

function renderProtected(user: User | null, isLoading: boolean, allowedRoles?: Role[]) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <AuthContext.Provider value={{ user, accessToken: null, isLoading, login: vi.fn(), logout: vi.fn() }}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/" element={<div>role home</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute allowedRoles={allowedRoles}>
                <div>secret content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('renders nothing while auth state is loading', () => {
    renderProtected(null, true)
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  it('redirects to /login when there is no user', () => {
    renderProtected(null, false)
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('redirects to / when the user role is not allowed', () => {
    const cashier: User = { id: '1', name: 'Cashier', email: 'c@x.com', role: 'CASHIER' }
    renderProtected(cashier, false, ['ADMIN'])
    expect(screen.getByText('role home')).toBeInTheDocument()
  })

  it('renders children when the user has an allowed role', () => {
    const admin: User = { id: '1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }
    renderProtected(admin, false, ['ADMIN'])
    expect(screen.getByText('secret content')).toBeInTheDocument()
  })
})
