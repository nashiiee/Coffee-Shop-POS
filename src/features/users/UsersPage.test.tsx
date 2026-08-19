import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsersPage } from './UsersPage'
import { AuthContext } from '../auth/authContext'
import * as usersApi from './api'
import type { User } from '../auth/types'
import type { Cashier } from './types'

vi.mock('./api')

const admin: User = { id: 'admin-1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: admin, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      <UsersPage />
    </AuthContext.Provider>,
  )
}

const cara: Cashier = { id: 'cashier-1', name: 'Cara', email: 'cara@shop.test', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }

beforeEach(() => {
  vi.mocked(usersApi.listCashiers).mockResolvedValue([cara])
})

describe('UsersPage', () => {
  it('lists cashier accounts with their status', async () => {
    renderPage()
    expect(await screen.findByText('Cara')).toBeInTheDocument()
    expect(screen.getByText('cara@shop.test')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('creates a new cashier from the form', async () => {
    const user = userEvent.setup()
    vi.mocked(usersApi.createCashier).mockResolvedValue({ ...cara, id: 'cashier-2', name: 'Maria', email: 'maria@shop.test' })
    renderPage()
    await screen.findByText('Cara')

    await user.type(screen.getByLabelText('Name'), 'Maria')
    await user.type(screen.getByLabelText('Email'), 'maria@shop.test')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Create cashier' }))

    await waitFor(() =>
      expect(usersApi.createCashier).toHaveBeenCalledWith('token', {
        name: 'Maria',
        email: 'maria@shop.test',
        password: 'correct-horse-battery',
      }),
    )
  })

  it('disables an active cashier', async () => {
    const user = userEvent.setup()
    vi.mocked(usersApi.disableUser).mockResolvedValue({ ...cara, isActive: false })
    renderPage()
    await screen.findByText('Cara')

    await user.click(screen.getByRole('button', { name: 'Disable' }))

    await waitFor(() => expect(usersApi.disableUser).toHaveBeenCalledWith('token', 'cashier-1'))
  })

  it('reactivates a disabled cashier', async () => {
    const user = userEvent.setup()
    vi.mocked(usersApi.listCashiers).mockResolvedValue([{ ...cara, isActive: false }])
    vi.mocked(usersApi.reactivateUser).mockResolvedValue({ ...cara, isActive: true })
    renderPage()
    await screen.findByText('Cara')

    await user.click(screen.getByRole('button', { name: 'Reactivate' }))

    await waitFor(() => expect(usersApi.reactivateUser).toHaveBeenCalledWith('token', 'cashier-1'))
  })

  it('resets a cashier password', async () => {
    const user = userEvent.setup()
    vi.mocked(usersApi.resetPassword).mockResolvedValue(undefined)
    renderPage()
    await screen.findByText('Cara')

    await user.click(screen.getByRole('button', { name: 'Reset password' }))
    await user.type(screen.getByLabelText('New password for Cara'), 'new-correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(usersApi.resetPassword).toHaveBeenCalledWith('token', 'cashier-1', 'new-correct-horse-battery'))
  })

  it('shows an error message when loading cashiers fails', async () => {
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(usersApi.listCashiers).mockRejectedValue(new ApiError(500, 'SERVER_ERROR', 'Failed to load cashiers'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load cashiers')
  })
})
