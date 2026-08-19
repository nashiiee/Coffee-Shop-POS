import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditLogPage } from './AuditLogPage'
import { AuthContext } from '../auth/authContext'
import * as auditApi from './api'
import type { User } from '../auth/types'
import type { AuditLogListResponse } from './types'

vi.mock('./api')

const admin: User = { id: 'admin-1', name: 'Admin', email: 'a@x.com', role: 'ADMIN' }

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: admin, accessToken: 'token', isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      <AuditLogPage />
    </AuthContext.Provider>,
  )
}

const baseResponse: AuditLogListResponse = {
  logs: [
    {
      id: 'audit-1',
      actorId: 'admin-1',
      actorName: 'Admin',
      action: 'PRODUCT_CREATED',
      resource: 'Product',
      resourceId: 'prod-12345678',
      previousState: null,
      newState: { name: 'Latte' },
      createdAt: '2026-08-19T10:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
}

beforeEach(() => {
  vi.mocked(auditApi.listAuditLogs).mockResolvedValue(baseResponse)
})

describe('AuditLogPage', () => {
  it('lists audit entries with a human-readable action label', async () => {
    renderPage()
    expect(await screen.findByText('Admin')).toBeInTheDocument()
    const row = screen.getByText('Admin').closest('tr')!
    expect(within(row).getByText('Product Created')).toBeInTheDocument()
  })

  it('refetches when the action filter changes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Admin')

    await user.selectOptions(screen.getByLabelText('Action'), 'USER_DISABLED')

    await waitFor(() =>
      expect(auditApi.listAuditLogs).toHaveBeenLastCalledWith('token', expect.objectContaining({ action: 'USER_DISABLED' })),
    )
  })

  it('refetches when the resource filter changes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Admin')

    await user.type(screen.getByLabelText('Resource'), 'Discount')

    await waitFor(() =>
      expect(auditApi.listAuditLogs).toHaveBeenLastCalledWith('token', expect.objectContaining({ resource: 'Discount' })),
    )
  })

  it('shows an error message when the request fails', async () => {
    const { ApiError } = await import('../../lib/apiClient')
    vi.mocked(auditApi.listAuditLogs).mockRejectedValue(new ApiError(500, 'SERVER_ERROR', 'Failed to load audit logs'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load audit logs')
  })

  it('shows an empty state when there are no matching entries', async () => {
    vi.mocked(auditApi.listAuditLogs).mockResolvedValue({ logs: [], total: 0, page: 1, pageSize: 20 })
    renderPage()
    expect(await screen.findByText('No matching audit entries.')).toBeInTheDocument()
  })
})
