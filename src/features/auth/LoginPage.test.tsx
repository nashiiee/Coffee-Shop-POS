import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LoginPage } from './LoginPage'
import { AuthContext } from './authContext'
import { ApiError } from '../../lib/apiClient'
import type { LoginRequest, User } from './types'

type LoginMock = (credentials: LoginRequest) => Promise<void>

function renderLoginPage(login: LoginMock, user: User | null = null) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthContext.Provider value={{ user, shop: null, accessToken: null, isLoading: false, login, logout: vi.fn() }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>role home</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('submits the entered credentials', async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    renderLoginPage(login)

    await userEvent.type(screen.getByLabelText('Email'), 'cashier@coffeeshop.test')
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: 'cashier@coffeeshop.test', password: 'correct-horse-battery-staple' }),
    )
  })

  it('shows the server error message when login fails', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password'))
    renderLoginPage(login)

    await userEvent.type(screen.getByLabelText('Email'), 'cashier@coffeeshop.test')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('redirects away from /login when already authenticated', () => {
    const admin: User = { id: '1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }
    renderLoginPage(vi.fn(), admin)
    expect(screen.getByText('role home')).toBeInTheDocument()
  })
})
